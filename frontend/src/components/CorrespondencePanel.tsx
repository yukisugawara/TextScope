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
interface SegPoint { label: string; x: number; y: number }

const WORD_COLOR = '#a855f7'
const WORD_SELECTED = '#fbbf24'
const SEG_COLOR = '#fb7185'

export default function CorrespondencePanel({ text, selectedWord, onSelectWord }: Props) {
  const { t } = useLocale()
  const chartRef = useRef<HTMLDivElement>(null)
  const [words, setWords] = useState<WordPoint[]>([])
  const [segments, setSegments] = useState<SegPoint[]>([])
  const [loading, setLoading] = useState(false)
  const [hoveredItem, setHoveredItem] = useState<string | null>(null)

  const handleExport = useCallback((filename: string, format: ImageFormat) => {
    if (chartRef.current) exportSvg(chartRef.current, filename, format)
  }, [])

  useEffect(() => {
    if (!text) return
    let cancelled = false
    setLoading(true)

    apiFetch('/api/correspondence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, top_n: 40, segments: 10 }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setWords(data.words || [])
        setSegments(data.segments || [])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [text])

  const renderWordDot = (props: any) => {
    const { cx, cy, payload } = props
    if (cx == null || cy == null) return null
    const name = payload.word as string
    const isHovered = hoveredItem === name
    const isSelected = name === selectedWord
    const isDimmed = hoveredItem !== null && !isHovered && !isSelected
    const color = isSelected ? WORD_SELECTED : WORD_COLOR
    const r = isSelected ? 6 : isHovered ? 6 : 4

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
          opacity={isDimmed ? 0.08 : isHovered || isSelected ? 1 : 0.7}
          fontWeight={isHovered || isSelected ? 600 : 400}
          style={{ pointerEvents: 'none' }}
        >
          {name}
        </text>
      </g>
    )
  }

  const renderSegDot = (props: any) => {
    const { cx, cy, payload } = props
    if (cx == null || cy == null) return null
    const name = payload.label as string
    const isHovered = hoveredItem === name
    const isDimmed = hoveredItem !== null && !isHovered

    return (
      <g
        onMouseEnter={() => setHoveredItem(name)}
        onMouseLeave={() => setHoveredItem(null)}
      >
        {isHovered && <rect x={cx - 10} y={cy - 10} width={20} height={20} rx={3} fill={SEG_COLOR} opacity={0.15} />}
        <rect x={cx - 4} y={cy - 4} width={8} height={8} rx={2} fill={SEG_COLOR} opacity={isDimmed ? 0.15 : 0.8} />
        <text
          x={cx} y={cy - 8}
          textAnchor="middle" fontSize={9} fill={SEG_COLOR}
          stroke="var(--color-emo-bg)" strokeWidth={3} paintOrder="stroke"
          opacity={isDimmed ? 0.08 : isHovered ? 1 : 0.6}
          fontWeight={isHovered ? 600 : 400}
          style={{ pointerEvents: 'none' }}
        >
          {name}
        </text>
      </g>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-white/10 shrink-0">
        <span className="flex items-center gap-1 text-xs text-white/40">
          <span className="inline-block w-2 h-2 rounded-full" style={{background: WORD_COLOR}} />{t('correspondence.words')}
          <span className="inline-block w-2 h-2 rounded-sm ml-1" style={{background: SEG_COLOR}} />{t('correspondence.segments')}
        </span>
        {words.length > 0 && (
          <div className="ml-auto">
            <SaveImagePopover panelName="correspondence" formats={['png', 'jpg', 'svg']} onSave={handleExport} t={t} />
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
            {t('correspondence.noData')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis type="number" dataKey="x" tick={{ fontSize: 10, fill: 'var(--chart-tick)' }} axisLine={{ stroke: 'var(--chart-axis)' }}>
                <Label value={t('correspondence.dim1')} position="insideBottom" offset={-5} style={{ fontSize: 10, fill: 'var(--chart-tick)' }} />
              </XAxis>
              <YAxis type="number" dataKey="y" tick={{ fontSize: 10, fill: 'var(--chart-tick)' }} axisLine={{ stroke: 'var(--chart-axis)' }}>
                <Label value={t('correspondence.dim2')} angle={-90} position="insideLeft" offset={10} style={{ fontSize: 10, fill: 'var(--chart-tick)' }} />
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
                      <span className="font-medium">{d.word || d.label}</span>
                      <span className="text-white/40 ml-2">({d.x?.toFixed(3)}, {d.y?.toFixed(3)})</span>
                    </div>
                  )
                }}
              />
              {/* Segment scatter (squares) */}
              <Scatter data={segments} fill={SEG_COLOR} shape={renderSegDot} name="Segments" />
              {/* Word scatter (circles) */}
              <Scatter data={words} fill={WORD_COLOR} shape={renderWordDot} name="Words" />
            </ScatterChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
