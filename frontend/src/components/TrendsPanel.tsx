import { useEffect, useState, useCallback } from 'react'
import { apiFetch } from '../api'
import { useLocale } from '../i18n'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts'

const EMO_COLORS = [
  '#a855f7', '#ec4899', '#2dd4bf', '#f472b6', '#818cf8',
  '#fb923c', '#34d399', '#fbbf24', '#c084fc', '#fb7185',
]

// Dashed style for concept lines
const CONCEPT_DASH = '6 3'

interface ConceptSeries {
  name: string
  segmentCounts: number[]
}

interface Props {
  text: string
  trackedWords: string[]
  onToggleTrack: (word: string) => void
  selectedWord: string
  onSelectWord: (word: string) => void
  conceptSeries?: ConceptSeries[]
  onRemoveConcept?: (name: string) => void
}

type DataPoint = { segment: string } & Record<string, number>

export default function TrendsPanel({
  text, trackedWords, onToggleTrack, selectedWord, onSelectWord,
  conceptSeries = [], onRemoveConcept,
}: Props) {
  const { t } = useLocale()
  const [data, setData] = useState<DataPoint[]>([])
  const allKeys = [...trackedWords, ...conceptSeries.map((c) => c.name)]

  useEffect(() => {
    if (!text || (trackedWords.length === 0 && conceptSeries.length === 0)) {
      setData([])
      return
    }

    // If only concepts, build data from them directly
    if (trackedWords.length === 0 && conceptSeries.length > 0) {
      const n = conceptSeries[0]?.segmentCounts.length ?? 10
      const points: DataPoint[] = Array.from({ length: n }, (_, i) => {
        const pt: DataPoint = { segment: `${i + 1}` }
        for (const c of conceptSeries) pt[c.name] = c.segmentCounts[i] ?? 0
        return pt
      })
      setData(points)
      return
    }

    let cancelled = false

    apiFetch('/api/trends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, keywords: trackedWords, segments: 10 }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return
        const points: DataPoint[] = (res.labels as string[]).map((label: string, i: number) => {
          const pt: DataPoint = { segment: label }
          for (const kw of trackedWords) pt[kw] = res.series[kw]?.[i] ?? 0
          for (const c of conceptSeries) pt[c.name] = c.segmentCounts[i] ?? 0
          return pt
        })
        setData(points)
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [text, trackedWords, conceptSeries])

  const handleLegendClick = useCallback(
    (entry: { value?: string }) => {
      if (entry.value) onSelectWord(entry.value)
    },
    [onSelectWord],
  )

  const conceptNames = new Set(conceptSeries.map((c) => c.name))

  return (
    <div className="flex flex-col h-full">
      {/* Tracked chips */}
      {allKeys.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-white/10">
          {trackedWords.map((w, i) => (
            <button
              key={w}
              onClick={() => onToggleTrack(w)}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border cursor-pointer transition-colors"
              style={{
                borderColor: EMO_COLORS[i % EMO_COLORS.length],
                color: EMO_COLORS[i % EMO_COLORS.length],
                backgroundColor: selectedWord === w ? `${EMO_COLORS[i % EMO_COLORS.length]}15` : 'transparent',
              }}
            >
              {w} <span className="opacity-60">&times;</span>
            </button>
          ))}
          {conceptSeries.map((c, i) => (
            <button
              key={c.name}
              onClick={() => onRemoveConcept?.(c.name)}
              className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border border-dashed cursor-pointer transition-colors"
              style={{
                borderColor: EMO_COLORS[(trackedWords.length + i) % EMO_COLORS.length],
                color: EMO_COLORS[(trackedWords.length + i) % EMO_COLORS.length],
              }}
            >
              {c.name} <span className="opacity-60">&times;</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 min-h-0 p-2" ref={chartRef}>
        {data.length === 0 ? (
          <div className="h-full flex items-center justify-center text-white/20 text-sm">
            {allKeys.length === 0
              ? t('trends.trackPrompt')
              : t('trends.loading')}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="segment" tick={{ fontSize: 11, fill: 'var(--chart-tick)' }} axisLine={{ stroke: 'var(--chart-axis)' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: 'var(--chart-tick)' }} axisLine={{ stroke: 'var(--chart-axis)' }} width={30} />
              <Tooltip
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: '1px solid var(--chart-tooltip-border)',
                  backgroundColor: 'var(--chart-bg)',
                  backdropFilter: 'blur(12px)',
                  color: 'var(--chart-text)',
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12, cursor: 'pointer', color: 'var(--chart-legend)' }} onClick={handleLegendClick} />
              {allKeys.map((kw, i) => (
                <Line
                  key={kw}
                  type="monotone"
                  dataKey={kw}
                  stroke={EMO_COLORS[i % EMO_COLORS.length]}
                  strokeWidth={selectedWord === kw ? 3 : 1.5}
                  strokeDasharray={conceptNames.has(kw) ? CONCEPT_DASH : undefined}
                  dot={{ r: selectedWord === kw ? 4 : 2 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
