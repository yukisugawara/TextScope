import { useEffect, useRef, useMemo, useCallback } from 'react'
import cloud from 'd3-cloud'
import { useLocale } from '../i18n'
import { exportCanvas } from '../exportImage'
import type { ImageFormat } from '../exportImage'
import SaveImagePopover from './SaveImagePopover'

interface FreqItem {
  word: string
  count: number
}

interface Props {
  frequencies: FreqItem[]
  selectedWord: string
  onSelectWord: (word: string) => void
}

const EMO_COLORS = [
  '#a855f7', '#ec4899', '#2dd4bf', '#f472b6', '#818cf8',
  '#fb923c', '#34d399', '#fbbf24', '#c084fc', '#fb7185',
]

const MAX_WORDS = 80

export default function WordCloudPanel({ frequencies, selectedWord, onSelectWord }: Props) {
  const { t } = useLocale()
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wordsRef = useRef<cloud.Word[]>([])
  const countMapRef = useRef<Map<string, number>>(new Map())
  const hoveredRef = useRef<string | null>(null)

  const top = useMemo(
    () => frequencies.slice(0, MAX_WORDS),
    [frequencies],
  )

  const maxCount = useMemo(() => Math.max(...top.map((w) => w.count), 1), [top])

  // Keep count map in sync
  useEffect(() => {
    const m = new Map<string, number>()
    for (const item of top) m.set(item.word, item.count)
    countMapRef.current = m
  }, [top])

  // Shared hit-test: returns the cloud.Word under (mx, my) or null
  const hitTest = useCallback((mx: number, my: number): cloud.Word | null => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const cx = rect.width / 2
    const cy = rect.height / 2

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    for (const word of wordsRef.current) {
      if (word.x == null || word.y == null || !word.size || !word.text) continue

      const count = countMapRef.current.get(word.text) ?? 0
      const ratio = count / Math.max(maxCount, 1)
      const weight = Math.round(400 + ratio * 400)

      ctx.save()
      ctx.font = `${weight} ${word.size}px sans-serif`
      const tw = ctx.measureText(word.text).width
      ctx.restore()

      const wx = cx + word.x
      const wy = cy + word.y

      if (word.rotate === 90) {
        const halfH = tw / 2
        const halfW = word.size / 2
        if (mx >= wx - halfW && mx <= wx + halfW && my >= wy - halfH && my <= wy + halfH) {
          return word
        }
      } else {
        const halfW = tw / 2
        const halfH = word.size / 2
        if (mx >= wx - halfW && mx <= wx + halfW && my >= wy - halfH && my <= wy + halfH) {
          return word
        }
      }
    }
    return null
  }, [maxCount])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    const w = rect.width
    const h = rect.height

    canvas.width = w * dpr
    canvas.height = h * dpr
    canvas.style.width = `${w}px`
    canvas.style.height = `${h}px`
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    ctx.clearRect(0, 0, w, h)

    const words = wordsRef.current
    const hovered = hoveredRef.current
    const someHovered = hovered !== null

    ctx.textBaseline = 'middle'

    // Store hovered word position for tooltip
    let tooltipWord: cloud.Word | null = null
    let tooltipScreenX = 0
    let tooltipScreenY = 0

    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      if (word.x == null || word.y == null || !word.size || !word.text) continue

      const isSelected = word.text === selectedWord
      const isHovered = word.text === hovered
      const count = countMapRef.current.get(word.text) ?? 0
      const ratio = count / Math.max(maxCount, 1)
      const weight = Math.round(400 + ratio * 400)
      const baseAlpha = 0.55 + ratio * 0.45
      const color = EMO_COLORS[i % EMO_COLORS.length]

      ctx.save()
      ctx.translate(w / 2 + word.x, h / 2 + word.y)
      if (word.rotate) ctx.rotate((word.rotate * Math.PI) / 180)

      if (isHovered && !isSelected) {
        ctx.scale(1.1, 1.1)
      }

      ctx.font = `${weight} ${word.size}px sans-serif`
      ctx.textAlign = 'center'

      if (isSelected) {
        ctx.fillStyle = '#fbbf24'
        ctx.globalAlpha = 1
        ctx.shadowColor = 'rgba(251, 191, 36, 0.5)'
        ctx.shadowBlur = 18
      } else if (isHovered) {
        ctx.fillStyle = color
        ctx.globalAlpha = 1
        ctx.shadowColor = color.replace(/^#/, '#') + '80' // 50% alpha hex
        ctx.shadowBlur = 14
      } else if (someHovered) {
        ctx.fillStyle = color
        ctx.globalAlpha = baseAlpha * 0.3
        ctx.shadowBlur = 0
      } else {
        ctx.fillStyle = color
        ctx.globalAlpha = baseAlpha
        ctx.shadowColor = color + '4D' // 30% alpha hex
        ctx.shadowBlur = 4
      }

      ctx.fillText(word.text, 0, 0)
      ctx.restore()

      if (isHovered) {
        tooltipWord = word
        tooltipScreenX = w / 2 + word.x
        tooltipScreenY = h / 2 + word.y
      }
    }

    // Draw tooltip badge for hovered word
    if (tooltipWord && tooltipWord.text) {
      const count = countMapRef.current.get(tooltipWord.text) ?? 0
      const label = `${tooltipWord.text}: ${count}`

      ctx.save()
      ctx.font = '600 12px sans-serif'
      ctx.textBaseline = 'top'
      const tm = ctx.measureText(label)
      const padX = 8
      const padY = 5
      const bw = tm.width + padX * 2
      const bh = 12 + padY * 2 // font size + padding

      // Position tooltip above the word, clamped within canvas
      let tx = tooltipScreenX - bw / 2
      let ty = tooltipScreenY - (tooltipWord.size! / 2) - bh - 6
      if (tx < 4) tx = 4
      if (tx + bw > w - 4) tx = w - 4 - bw
      if (ty < 4) ty = tooltipScreenY + (tooltipWord.size! / 2) + 6

      // Rounded rect background
      const r = 6
      ctx.globalAlpha = 0.85
      ctx.fillStyle = 'rgba(23, 23, 23, 0.92)'
      ctx.beginPath()
      ctx.moveTo(tx + r, ty)
      ctx.lineTo(tx + bw - r, ty)
      ctx.quadraticCurveTo(tx + bw, ty, tx + bw, ty + r)
      ctx.lineTo(tx + bw, ty + bh - r)
      ctx.quadraticCurveTo(tx + bw, ty + bh, tx + bw - r, ty + bh)
      ctx.lineTo(tx + r, ty + bh)
      ctx.quadraticCurveTo(tx, ty + bh, tx, ty + bh - r)
      ctx.lineTo(tx, ty + r)
      ctx.quadraticCurveTo(tx, ty, tx + r, ty)
      ctx.closePath()
      ctx.fill()

      // Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Text
      ctx.globalAlpha = 1
      ctx.fillStyle = '#e5e5e5'
      ctx.textAlign = 'left'
      ctx.shadowBlur = 0
      ctx.fillText(label, tx + padX, ty + padY)
      ctx.restore()
    }
  }, [selectedWord, maxCount])

  // Compute layout when data changes
  useEffect(() => {
    const container = containerRef.current
    if (!container || top.length === 0) return

    const rect = container.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    if (w === 0 || h === 0) return

    const minFont = 12
    const maxFont = Math.min(w, h) * 0.15

    const layout = cloud()
      .size([w, h])
      .words(
        top.map((item) => ({
          text: item.word,
          size: minFont + ((item.count / maxCount) * (maxFont - minFont)),
        })),
      )
      .padding(3)
      .rotate(() => (Math.random() > 0.65 ? 90 : 0))
      .font('sans-serif')
      .fontSize((d) => d.size!)
      .on('end', (placed) => {
        wordsRef.current = placed
        draw()
      })

    layout.start()
  }, [top, maxCount, draw])

  // Re-draw when selection changes (without re-layout)
  useEffect(() => {
    draw()
  }, [draw, selectedWord])

  // Re-layout on container resize (panel drag)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let timer: ReturnType<typeof setTimeout>
    const ro = new ResizeObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        if (top.length === 0) return
        const rect = container.getBoundingClientRect()
        const w = rect.width
        const h = rect.height
        if (w === 0 || h === 0) return

        const minFont = 12
        const maxFont = Math.min(w, h) * 0.15

        cloud()
          .size([w, h])
          .words(
            top.map((item) => ({
              text: item.word,
              size: minFont + ((item.count / maxCount) * (maxFont - minFont)),
            })),
          )
          .padding(3)
          .rotate(() => (Math.random() > 0.65 ? 90 : 0))
          .font('sans-serif')
          .fontSize((d) => d.size!)
          .on('end', (placed) => {
            wordsRef.current = placed
            draw()
          })
          .start()
      }, 300)
    })
    ro.observe(container)
    return () => { clearTimeout(timer); ro.disconnect() }
  }, [top, maxCount, draw])

  // Click handling via shared hit-test
  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const hit = hitTest(mx, my)
      if (hit?.text) {
        onSelectWord(hit.text)
      }
    },
    [onSelectWord, hitTest],
  )

  // Hover handling via shared hit-test
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current
      if (!canvas) return

      const rect = canvas.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top

      const hit = hitTest(mx, my)
      const newHovered = hit?.text ?? null

      if (newHovered !== hoveredRef.current) {
        hoveredRef.current = newHovered
        canvas.style.cursor = newHovered ? 'pointer' : 'default'
        draw()
      }
    },
    [hitTest, draw],
  )

  const handleMouseLeave = useCallback(() => {
    if (hoveredRef.current !== null) {
      hoveredRef.current = null
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = 'default'
      draw()
    }
  }, [draw])

  const handleExport = useCallback((filename: string, format: ImageFormat) => {
    if (canvasRef.current) exportCanvas(canvasRef.current, filename, format)
  }, [])

  return (
    <div className="flex flex-col h-full">
      {top.length > 0 && (
        <div className="flex items-center px-4 py-1.5 border-b border-white/8 shrink-0">
          <div className="ml-auto">
            <SaveImagePopover panelName="wordcloud" formats={['png', 'jpg']} onSave={handleExport} t={t} />
          </div>
        </div>
      )}
      <div ref={containerRef} className="flex-1 relative min-h-0">
        {top.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center text-white/20 text-sm">
            {t('cloud.noData')}
          </div>
        ) : (
          <canvas
            ref={canvasRef}
            onClick={handleClick}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className="absolute inset-0 cursor-pointer"
          />
        )}
      </div>
    </div>
  )
}
