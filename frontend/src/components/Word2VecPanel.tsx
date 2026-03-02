import { useEffect, useState, useRef, useCallback } from 'react'
import { apiFetch } from '../api'
import { useLocale } from '../i18n'
import { exportSvg } from '../exportImage'
import type { ImageFormat } from '../exportImage'
import SaveImagePopover from './SaveImagePopover'
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Label,
} from 'recharts'

interface Props {
  text: string
  selectedWord: string
  onSelectWord: (word: string) => void
}

interface WordPoint { word: string; x: number; y: number }
interface Neighbor { word: string; similarity: number }

const COLOR_NORMAL = '#a855f7'   // violet
const COLOR_SELECTED = '#f59e0b' // amber
const COLOR_NEIGHBOR = '#14b8a6' // teal

export default function Word2VecPanel({ text, selectedWord, onSelectWord }: Props) {
  const { t } = useLocale()
  const chartRef = useRef<HTMLDivElement>(null)
  const [words, setWords] = useState<WordPoint[]>([])
  const [neighbors, setNeighbors] = useState<Neighbor[]>([])
  const [loading, setLoading] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)
  const neighborWords = useRef(new Set<string>())

  const handleExport = useCallback((filename: string, format: ImageFormat) => {
    if (chartRef.current) exportSvg(chartRef.current, filename, format)
  }, [])

  // Fetch scatter data when text changes
  useEffect(() => {
    if (!text) return
    let cancelled = false
    setLoading(true)

    apiFetch('/api/word2vec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, top_n: 80 }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setWords(data.words || [])
        setNeighbors([])
        neighborWords.current = new Set()
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [text])

  // Fetch neighbors when selectedWord changes
  useEffect(() => {
    if (!text || !selectedWord) {
      setNeighbors([])
      neighborWords.current = new Set()
      return
    }
    let cancelled = false

    apiFetch('/api/word2vec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, top_n: 80, selected_word: selectedWord }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        const nb: Neighbor[] = data.neighbors || []
        setNeighbors(nb)
        neighborWords.current = new Set(nb.map((n) => n.word))
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [text, selectedWord])

  const getColor = (word: string) => {
    if (word === selectedWord) return COLOR_SELECTED
    if (neighborWords.current.has(word)) return COLOR_NEIGHBOR
    return COLOR_NORMAL
  }

  const renderWordDot = (props: any) => {
    const { cx, cy, payload } = props
    if (cx == null || cy == null) return null
    const name = payload.word as string
    const isHovered = hoveredItem === name
    const isSelected = name === selectedWord
    const isNeighbor = neighborWords.current.has(name)
    const isDimmed = hoveredItem !== null && !isHovered && !isSelected
    const color = getColor(name)
    const r = isSelected ? 6 : isHovered ? 6 : isNeighbor ? 5 : 4

    return (
      <g
        onMouseEnter={() => setHoveredItem(name)}
        onMouseLeave={() => setHoveredItem(null)}
        onClick={() => onSelectWord(name)}
        style={{ cursor: 'pointer' }}
      >
        {isHovered && <circle cx={cx} cy={cy} r={16} fill={color} opacity={0.15} />}
        <circle cx={cx} cy={cy} r={r} fill={color} opacity={isDimmed ? 0.15 : 1} />
        <text
          x={cx} y={cy - r - 3}
          textAnchor="middle" fontSize={9} fill={color}
          stroke="var(--color-emo-bg)" strokeWidth={3} paintOrder="stroke"
          opacity={isDimmed ? 0.08 : isHovered || isSelected || isNeighbor ? 1 : 0.7}
          fontWeight={isHovered || isSelected ? 600 : 400}
          style={{ pointerEvents: 'none' }}
        >
          {name}
        </text>
      </g>
    )
  }

  return (
    <div className="flex h-full">
      {/* Chart area */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-3 px-4 py-1.5 border-b border-white/10 shrink-0">
          <span className="flex items-center gap-1 text-xs text-white/40">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLOR_NORMAL }} />{t('w2v.words')}
          </span>
          <span className="flex items-center gap-1 text-xs text-white/40">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLOR_SELECTED }} />{t('w2v.selected')}
          </span>
          <span className="flex items-center gap-1 text-xs text-white/40">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: COLOR_NEIGHBOR }} />{t('w2v.similar')}
          </span>
          {words.length > 0 && (
            <div className="ml-auto">
              <SaveImagePopover panelName="word2vec" formats={['png', 'jpg', 'svg']} onSave={handleExport} t={t} />
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0 p-2 relative" ref={chartRef}>
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-violet-500 border-r-transparent" />
            </div>
          ) : words.length === 0 ? (
            <div className="h-full flex items-center justify-center text-white/20 text-sm">
              {t('w2v.noData')}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis type="number" dataKey="x" tick={{ fontSize: 10, fill: 'var(--chart-tick)' }} axisLine={{ stroke: 'var(--chart-axis)' }}>
                  <Label value="PC1" position="insideBottom" offset={-5} style={{ fontSize: 10, fill: 'var(--chart-tick)' }} />
                </XAxis>
                <YAxis type="number" dataKey="y" tick={{ fontSize: 10, fill: 'var(--chart-tick)' }} axisLine={{ stroke: 'var(--chart-axis)' }}>
                  <Label value="PC2" angle={-90} position="insideLeft" offset={10} style={{ fontSize: 10, fill: 'var(--chart-tick)' }} />
                </YAxis>
                <ReferenceLine x={0} stroke="var(--chart-axis)" />
                <ReferenceLine y={0} stroke="var(--chart-axis)" />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  content={({ payload }) => {
                    if (!payload?.length) return null
                    const d = payload[0].payload
                    return (
                      <div className="bg-[var(--chart-bg)] border rounded-lg px-3 py-1.5 text-xs backdrop-blur-xl text-emo-text" style={{ borderColor: 'var(--chart-tooltip-border)' }}>
                        <span className="font-medium">{d.word}</span>
                        <span className="text-white/40 ml-2">({d.x?.toFixed(3)}, {d.y?.toFixed(3)})</span>
                      </div>
                    )
                  }}
                />
                <Scatter data={words} fill={COLOR_NORMAL} shape={renderWordDot} name="Words" />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Neighbors sidebar */}
      <div className="w-52 border-l border-white/10 flex flex-col shrink-0">
        <div className="px-3 py-1.5 border-b border-white/10 text-xs text-white/40 font-semibold">
          {t('w2v.similarWords')}
        </div>
        <div className="flex-1 overflow-y-auto">
          {selectedWord ? (
            neighbors.length > 0 ? (
              <table className="w-full text-xs">
                <tbody>
                  {neighbors.map((n) => (
                    <tr
                      key={n.word}
                      className="hover:bg-white/5 cursor-pointer transition-colors"
                      onClick={() => onSelectWord(n.word)}
                    >
                      <td className="px-3 py-1 font-mono" style={{ color: COLOR_NEIGHBOR }}>{n.word}</td>
                      <td className="px-2 py-1 text-right text-white/30 tabular-nums">{n.similarity.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-3 text-xs text-white/20">{t('w2v.noSimilar')}</div>
            )
          ) : (
            <div className="p-3 text-xs text-white/20">{t('w2v.clickToSee')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
