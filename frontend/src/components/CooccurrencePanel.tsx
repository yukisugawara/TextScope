import { useEffect, useRef, useState, useCallback } from 'react'
import cytoscape from 'cytoscape'
import { apiFetch } from '../api'
import { useTheme } from '../theme'
import { useLocale } from '../i18n'
import { exportCytoscape } from '../exportImage'
import type { ImageFormat } from '../exportImage'
import SaveImagePopover from './SaveImagePopover'

interface Props {
  text: string
  selectedWord: string
  onSelectWord: (word: string) => void
}

type ColorMode = 'default' | 'degree' | 'betweenness' | 'closeness' | 'community'

interface Node {
  id: string; count: number
  degree: number; betweenness: number; closeness: number; community: number
}
interface Edge { source: string; target: string; weight: number }
interface ApiResponse { nodes: Node[]; edges: Edge[]; communityCount: number }

const COMMUNITY_COLORS = [
  '#a855f7', '#ec4899', '#2dd4bf', '#f97316', '#3b82f6',
  '#eab308', '#ef4444', '#22c55e', '#8b5cf6', '#06b6d4',
]

/** Interpolate violet → pink → amber for 0–1 range */
function lerpColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t))
  // violet(168,85,247) → pink(236,72,153) → amber(251,191,36)
  let r: number, g: number, b: number
  if (clamped <= 0.5) {
    const s = clamped * 2
    r = 168 + (236 - 168) * s
    g = 85 + (72 - 85) * s
    b = 247 + (153 - 247) * s
  } else {
    const s = (clamped - 0.5) * 2
    r = 236 + (251 - 236) * s
    g = 72 + (191 - 72) * s
    b = 153 + (36 - 153) * s
  }
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`
}

function getMetricColor(node: Node, mode: ColorMode, maxVals: Record<string, number>): string {
  if (mode === 'default') return '#a855f7'
  if (mode === 'community') return COMMUNITY_COLORS[node.community % COMMUNITY_COLORS.length]
  const val = node[mode]
  const max = maxVals[mode] || 1
  return lerpColor(val / max)
}

const COLOR_MODES: ColorMode[] = ['default', 'degree', 'betweenness', 'closeness', 'community']

export default function CooccurrencePanel({ text, selectedWord, onSelectWord }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const dataRef = useRef<ApiResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [colorMode, setColorMode] = useState<ColorMode>('default')
  const [hoveredMode, setHoveredMode] = useState<ColorMode | null>(null)
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; word: string; count: number
    degree: number; betweenness: string; closeness: string
  } | null>(null)
  const { theme } = useTheme()
  const { t } = useLocale()

  const handleExport = useCallback((filename: string, format: ImageFormat) => {
    if (cyRef.current) exportCytoscape(cyRef.current, filename, format)
  }, [])

  const showTooltip = useCallback((node: cytoscape.NodeSingular) => {
    const container = containerRef.current
    if (!container) return
    const pos = node.renderedPosition()
    const rect = container.getBoundingClientRect()
    // Clamp position so tooltip doesn't overflow container
    const tooltipW = 180
    const tooltipH = 100
    let x = pos.x
    let y = pos.y - (node.renderedHeight() / 2) - 8
    if (x + tooltipW / 2 > rect.width) x = rect.width - tooltipW / 2 - 4
    if (x - tooltipW / 2 < 0) x = tooltipW / 2 + 4
    if (y - tooltipH < 0) y = pos.y + (node.renderedHeight() / 2) + 8
    setTooltip({
      x, y,
      word: node.data('label'),
      count: node.data('count'),
      degree: node.data('degree'),
      betweenness: node.data('betweenness'),
      closeness: node.data('closeness'),
    })
  }, [])

  const hideTooltip = useCallback(() => setTooltip(null), [])

  // Fetch & render
  useEffect(() => {
    if (!text) return
    let cancelled = false
    setLoading(true)

    // Read CSS variables for theme-aware colors
    const styles = getComputedStyle(document.documentElement)
    const nodeLabelColor = styles.getPropertyValue('--cy-node-label').trim()
    const edgeColor = styles.getPropertyValue('--cy-edge-color').trim()
    const isDark = document.documentElement.classList.contains('dark')
    const textOutlineColor = isDark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.8)'

    apiFetch('/api/cooccurrence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, top_n: 50, min_count: 1 }),
    })
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        if (cancelled || !containerRef.current) return
        dataRef.current = data

        const maxCount = Math.max(...data.nodes.map((n) => n.count), 1)
        const maxWeight = Math.max(...data.edges.map((e) => e.weight), 1)

        const mv = {
          degree: Math.max(...data.nodes.map(n => n.degree), 1e-9),
          betweenness: Math.max(...data.nodes.map(n => n.betweenness), 1e-9),
          closeness: Math.max(...data.nodes.map(n => n.closeness), 1e-9),
        }

        // Destroy previous instance
        if (cyRef.current) cyRef.current.destroy()

        const cy = cytoscape({
          container: containerRef.current,
          elements: [
            ...data.nodes.map((n) => ({
              data: {
                id: n.id,
                label: n.id,
                count: n.count,
                size: 20 + (n.count / maxCount) * 40,
                fontSize: Math.round(8 + (n.count / maxCount) * 6),
                metricColor: getMetricColor(n, colorMode, mv),
                degree: n.degree,
                betweenness: n.betweenness.toFixed(4),
                closeness: n.closeness.toFixed(4),
              },
            })),
            ...data.edges.map((e, i) => ({
              data: {
                id: `e${i}`, source: e.source, target: e.target,
                weight: e.weight,
                width: 1 + (e.weight / maxWeight) * 5,
                normalizedWeight: 0.2 + (e.weight / maxWeight) * 0.6,
              },
            })),
          ],
          style: [
            // 1. node base
            {
              selector: 'node',
              style: {
                label: 'data(label)',
                width: 'data(size)',
                height: 'data(size)',
                'font-size': 'data(fontSize)',
                'text-valign': 'center',
                'text-halign': 'center',
                'background-color': 'data(metricColor)',
                color: nodeLabelColor,
                'border-width': 0,
                'text-wrap': 'wrap',
                'text-max-width': '60px',
                'text-outline-width': 2,
                'text-outline-color': textOutlineColor,
                'shadow-blur': 8,
                'shadow-color': 'data(metricColor)',
                'shadow-opacity': 0.3,
                'shadow-offset-x': 0,
                'shadow-offset-y': 0,
                'transition-property': 'opacity shadow-blur shadow-opacity',
                'transition-duration': '200ms',
              } as any,
            },
            // 2. node.dimmed
            {
              selector: 'node.dimmed',
              style: {
                opacity: 0.15,
                'shadow-opacity': 0,
              } as any,
            },
            // 3. node.hovered-neighbor
            {
              selector: 'node.hovered-neighbor',
              style: {
                'shadow-blur': 14,
                'shadow-opacity': 0.5,
              } as any,
            },
            // 4. node.hovered
            {
              selector: 'node.hovered',
              style: {
                'shadow-blur': 20,
                'shadow-opacity': 0.7,
                'overlay-color': '#a855f7',
                'overlay-opacity': 0.12,
              } as any,
            },
            // 5. node.neighbor
            {
              selector: 'node.neighbor',
              style: {
                'background-color': '#2dd4bf',
                'shadow-color': '#2dd4bf',
                'shadow-blur': 12,
                'shadow-opacity': 0.5,
              } as any,
            },
            // 6. node.selected
            {
              selector: 'node.selected',
              style: {
                'background-color': '#fbbf24',
                'border-width': 2,
                'border-color': '#f59e0b',
                color: '#fef3c7',
                'shadow-color': '#fbbf24',
                'shadow-blur': 20,
                'shadow-opacity': 0.6,
                'overlay-color': '#f59e0b',
                'overlay-opacity': 0.1,
                opacity: 1,
              } as any,
            },
            // 7. edge base
            {
              selector: 'edge',
              style: {
                width: 'data(width)',
                'line-color': edgeColor,
                'curve-style': 'bezier',
                opacity: 'data(normalizedWeight)',
                'transition-property': 'opacity line-color',
                'transition-duration': '200ms',
              } as any,
            },
            // 8. edge.dimmed
            {
              selector: 'edge.dimmed',
              style: {
                opacity: 0.05,
              } as any,
            },
            // 9. edge.hovered-edge
            {
              selector: 'edge.hovered-edge',
              style: {
                'line-color': '#c084fc',
                opacity: 0.9,
              } as any,
            },
            // 10. edge.highlighted
            {
              selector: 'edge.highlighted',
              style: {
                'line-color': '#fbbf24',
                opacity: 1,
              } as any,
            },
          ],
          layout: {
            name: 'cose',
            animate: true,
            animationDuration: 800,
            nodeRepulsion: (node: cytoscape.NodeSingular) => {
              const deg = node.degree(false) as number
              return 6000 + deg * 1500
            },
            idealEdgeLength: (edge: cytoscape.EdgeSingular) => {
              const w = edge.data('weight') as number
              return 60 + (1 - w / maxWeight) * 80
            },
            edgeElasticity: (edge: cytoscape.EdgeSingular) => {
              const w = edge.data('weight') as number
              return 100 + (w / maxWeight) * 200
            },
            gravity: 0.25,
            initialTemp: 200,
          } as any,
          userZoomingEnabled: true,
          userPanningEnabled: true,
          boxSelectionEnabled: false,
        })

        cy.on('tap', 'node', (evt) => {
          const id = evt.target.id()
          onSelectWord(id)
        })

        // Hover effects
        cy.on('mouseover', 'node', (evt) => {
          const node = evt.target
          const neighborhood = node.neighborhood().add(node)
          cy.elements().not(neighborhood).addClass('dimmed')
          node.addClass('hovered')
          node.neighborhood('node').addClass('hovered-neighbor')
          node.connectedEdges().addClass('hovered-edge')
          showTooltip(node)
        })

        cy.on('mouseout', 'node', () => {
          cy.elements().removeClass('dimmed hovered hovered-neighbor hovered-edge')
          hideTooltip()
        })

        // Hide tooltip on pan/zoom
        cy.on('viewport', () => {
          hideTooltip()
        })

        cyRef.current = cy
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [text, onSelectWord, theme])

  // Recolor nodes when colorMode changes (no API refetch)
  useEffect(() => {
    const cy = cyRef.current
    const data = dataRef.current
    if (!cy || !data) return

    const mv = {
      degree: Math.max(...data.nodes.map(n => n.degree), 1e-9),
      betweenness: Math.max(...data.nodes.map(n => n.betweenness), 1e-9),
      closeness: Math.max(...data.nodes.map(n => n.closeness), 1e-9),
    }

    for (const n of data.nodes) {
      const ele = cy.getElementById(n.id)
      if (ele.length > 0) {
        ele.data('metricColor', getMetricColor(n, colorMode, mv))
      }
    }
  }, [colorMode])

  // Resize cytoscape on container resize (panel drag)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let timer: ReturnType<typeof setTimeout>
    const ro = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        const cy = cyRef.current
        if (cy) { cy.resize(); cy.fit() }
      }, 300)
    })
    ro.observe(container)
    return () => { clearTimeout(timer); ro.disconnect() }
  }, [])

  // Update highlights when selectedWord changes
  useEffect(() => {
    const cy = cyRef.current
    if (!cy) return

    cy.elements().removeClass('selected neighbor highlighted')
    setTooltip(null)

    if (!selectedWord) return
    const node = cy.getElementById(selectedWord)
    if (node.length === 0) return

    node.addClass('selected')
    const connectedEdges = node.connectedEdges()
    connectedEdges.addClass('highlighted')
    connectedEdges.connectedNodes().not(node).addClass('neighbor')
  }, [selectedWord])

  const modeKey = (m: ColorMode) => `cooccurrence.${m}` as const
  const communityCount = dataRef.current?.communityCount ?? 0

  return (
    <div className="flex flex-col h-full">
      {/* Color mode header bar */}
      <div className="relative">
        <div className="flex items-center gap-1.5 px-2 py-1 border-b border-white/10 bg-black/5 dark:bg-white/5 flex-wrap">
          <span className="text-[10px] text-gray-500 dark:text-gray-400 mr-0.5">
            {t('cooccurrence.colorMode')}:
          </span>
          {COLOR_MODES.map((m) => (
            <button
              key={m}
              onClick={() => setColorMode(m)}
              onMouseEnter={() => setHoveredMode(m)}
              onMouseLeave={() => setHoveredMode(null)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                colorMode === m
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-violet-500/20'
              }`}
            >
              {t(modeKey(m))}
            </button>
          ))}

          {/* Legend + export */}
          <div className="ml-auto flex items-center gap-1.5">
            {colorMode !== 'default' && colorMode !== 'community' && (
              <>
                <span className="text-[9px] text-gray-500 dark:text-gray-400">{t('cooccurrence.low')}</span>
                <div
                  className="h-2 w-16 rounded-sm"
                  style={{
                    background: 'linear-gradient(to right, rgb(168,85,247), rgb(236,72,153), rgb(251,191,36))',
                  }}
                />
                <span className="text-[9px] text-gray-500 dark:text-gray-400">{t('cooccurrence.high')}</span>
              </>
            )}
            {colorMode === 'community' && (
              <div className="flex items-center gap-0.5">
                {COMMUNITY_COLORS.slice(0, Math.max(communityCount, 1)).map((c, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                ))}
              </div>
            )}
            {dataRef.current && (
              <SaveImagePopover panelName="cooccurrence" formats={['png', 'jpg']} onSave={handleExport} t={t} />
            )}
          </div>
        </div>

        {/* Tooltip */}
        {hoveredMode && (
          <div className="absolute left-2 top-full mt-0.5 z-50 max-w-xs px-3 py-2 rounded-lg text-[11px] leading-relaxed bg-[var(--dropdown-bg)] border border-white/15 shadow-xl dropdown-glow text-white/70 pointer-events-none"
               style={{ animation: 'fade-in-up 0.15s ease-out both' }}>
            {t(`cooccurrence.${hoveredMode}.desc` as any)}
          </div>
        )}
      </div>

      <div ref={containerRef} className="flex-1 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'var(--overlay-bg)' }}>
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-violet-500 border-r-transparent" />
          </div>
        )}
        {tooltip && (
          <div
            className="absolute z-50 px-3 py-2 rounded-lg text-[11px] leading-relaxed bg-[var(--dropdown-bg)] border border-white/15 shadow-xl dropdown-glow text-white/70 pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
              animation: 'fade-in-up 0.12s ease-out both',
            }}
          >
            <div className="font-semibold text-white/90 mb-0.5">{tooltip.word}</div>
            <div>count: {tooltip.count}</div>
            <div>degree: {tooltip.degree}</div>
            <div>betweenness: {tooltip.betweenness}</div>
            <div>closeness: {tooltip.closeness}</div>
          </div>
        )}
      </div>
    </div>
  )
}
