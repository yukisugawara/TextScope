import { useEffect, useRef, useState, useCallback } from 'react'
import { apiFetch } from '../api'
import { useTheme } from '../theme'
import { useLocale } from '../i18n'
import { exportCanvas } from '../exportImage'
import type { ImageFormat } from '../exportImage'
import SaveImagePopover from './SaveImagePopover'

interface Props {
  text: string
  selectedWord: string
  onSelectWord: (word: string) => void
}

interface TreeNode {
  name: string
  distance?: number
  value?: number
  children?: TreeNode[]
}

// Recursively collect all leaf names under a node
function leafNames(node: TreeNode): string[] {
  if (!node.children) return node.name ? [node.name] : []
  return node.children.flatMap(leafNames)
}

// Flatten the tree into an ordered list of leaves (left-to-right)
function getLeafOrder(node: TreeNode): string[] {
  if (!node.children) return node.name ? [node.name] : []
  return node.children.flatMap(getLeafOrder)
}

const EMO_COLORS = [
  '#a855f7', '#ec4899', '#2dd4bf', '#f472b6', '#818cf8',
  '#fb923c', '#34d399', '#fbbf24', '#c084fc', '#fb7185',
]

export default function ClusterPanel({ text, selectedWord, onSelectWord }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<TreeNode | null>(null)
  const leafOrderRef = useRef<string[]>([])
  const [loading, setLoading] = useState(false)
  const { theme } = useTheme()
  const { t } = useLocale()

  const handleExport = useCallback((filename: string, format: ImageFormat) => {
    if (canvasRef.current) exportCanvas(canvasRef.current, filename, format)
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const tree = treeRef.current
    if (!canvas || !container || !tree) return

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    const W = rect.width
    const H = rect.height

    canvas.width = W * dpr
    canvas.height = H * dpr
    canvas.style.width = `${W}px`
    canvas.style.height = `${H}px`

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const leaves = leafOrderRef.current
    const n = leaves.length
    if (n === 0) return

    // Read CSS variables for theme-aware colors
    const styles = getComputedStyle(document.documentElement)
    const lineColor = styles.getPropertyValue('--canvas-line').trim()
    const labelColor = styles.getPropertyValue('--canvas-label').trim()

    // Layout params — horizontal dendrogram: labels on left, merges grow right
    const labelWidth = 90
    const padRight = 20
    const padY = 20
    const plotW = W - labelWidth - padRight
    const plotH = H - padY * 2

    // Map: leaf name → y position
    const leafY = new Map<string, number>()
    leaves.forEach((name, i) => {
      leafY.set(name, padY + (i + 0.5) * (plotH / n))
    })

    // Find max distance for x-scaling
    function maxDist(node: TreeNode): number {
      if (!node.children) return 0
      return Math.max(node.distance ?? 0, ...node.children.map(maxDist))
    }
    const dMax = maxDist(tree) || 1

    // Recursively draw, return y center
    function drawNode(node: TreeNode, depth: number): number {
      if (!node.children) {
        // Leaf — draw label
        const y = leafY.get(node.name) ?? 0
        const x = labelWidth
        const isSelected = node.name === selectedWord

        ctx.font = isSelected ? 'bold 12px sans-serif' : '11px sans-serif'
        ctx.fillStyle = isSelected ? '#fbbf24' : labelColor
        ctx.textAlign = 'right'
        ctx.textBaseline = 'middle'
        ctx.fillText(node.name, x - 6, y)

        return y
      }

      // Internal node
      const childYs = node.children.map((c) => drawNode(c, depth + 1))
      const yMin = Math.min(...childYs)
      const yMax = Math.max(...childYs)
      const yCenter = (yMin + yMax) / 2

      // x position based on distance
      const dist = node.distance ?? 0
      const x = labelWidth + (dist / dMax) * plotW

      // Draw vertical bar connecting children
      ctx.strokeStyle = lineColor
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(x, yMin)
      ctx.lineTo(x, yMax)
      ctx.stroke()

      // Draw horizontal bars to each child
      node.children.forEach((c, i) => {
        const cy = childYs[i]
        const childDist = c.distance ?? 0
        const cx = c.children ? labelWidth + (childDist / dMax) * plotW : labelWidth

        // Color by subtree
        const subtreeLeaves = leafNames(c)
        const hasSelected = subtreeLeaves.includes(selectedWord)
        ctx.strokeStyle = hasSelected ? '#fbbf24' : lineColor
        ctx.lineWidth = hasSelected ? 2 : 1.5

        ctx.beginPath()
        ctx.moveTo(x, cy)
        ctx.lineTo(cx, cy)
        ctx.stroke()
      })

      return yCenter
    }

    drawNode(tree, 0)
  }, [selectedWord, theme])

  // Fetch tree data
  useEffect(() => {
    if (!text) return
    let cancelled = false
    setLoading(true)

    apiFetch('/api/cluster', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, top_n: 30, segments: 10 }),
    })
      .then((r) => r.json())
      .then((data: { tree: TreeNode | null; labels: string[] }) => {
        if (cancelled) return
        treeRef.current = data.tree
        leafOrderRef.current = data.tree ? getLeafOrder(data.tree) : []
        draw()
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [text, draw])

  // Redraw on selection change
  useEffect(() => { draw() }, [draw, selectedWord])

  // Re-draw on container resize (panel drag)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let timer: ReturnType<typeof setTimeout>
    const ro = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => { draw() }, 300)
    })
    ro.observe(container)
    return () => { clearTimeout(timer); ro.disconnect() }
  }, [draw])

  // Click hit-test on leaf labels
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top

    const leaves = leafOrderRef.current
    const n = leaves.length
    if (n === 0) return

    const padY = 20
    const plotH = rect.height - padY * 2
    const rowH = plotH / n

    // Check if click is in label area (x < 90)
    if (mx > 95) return

    const idx = Math.floor((my - padY) / rowH)
    if (idx >= 0 && idx < n) {
      onSelectWord(leaves[idx])
    }
  }, [onSelectWord])

  const hasData = treeRef.current !== null

  return (
    <div className="flex flex-col h-full">
      {hasData && (
        <div className="flex items-center px-4 py-1.5 border-b border-white/8 shrink-0">
          <div className="ml-auto">
            <SaveImagePopover panelName="cluster" formats={['png', 'jpg']} onSave={handleExport} t={t} />
          </div>
        </div>
      )}
      <div ref={containerRef} className="flex-1 min-h-0 relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'var(--overlay-bg)' }}>
            <div className="h-6 w-6 animate-spin rounded-full border-3 border-violet-500 border-r-transparent" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          onClick={handleClick}
          className="absolute inset-0 cursor-pointer"
        />
      </div>
    </div>
  )
}
