import { useEffect, useState, useCallback, useRef } from 'react'
import { apiFetch } from '../api'
import { useLocale } from '../i18n'
import { exportMultipleSvgs } from '../exportImage'
import type { ImageFormat } from '../exportImage'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, CartesianGrid, ZAxis, Label,
} from 'recharts'

const EMO_COLORS = [
  '#a855f7', '#ec4899', '#2dd4bf', '#f472b6', '#818cf8',
  '#fb923c', '#34d399', '#fbbf24', '#c084fc', '#fb7185',
  '#a855f7', '#ec4899', '#2dd4bf', '#f472b6', '#818cf8',
]

interface TopicWord { word: string; weight: number }
interface Topic { id: number; label: string; words: TopicWord[] }
interface DocEntry {
  sentence_index: number
  snippet: string
  dominant_topic: number
  distribution: number[]
}

interface Props {
  text: string
  selectedWord: string
  onSelectWord: (word: string) => void
}

type TopicMethod = 'lda' | 'nmf' | 'bertopic'

export default function TopicPanel({ text, selectedWord, onSelectWord }: Props) {
  const { t } = useLocale()
  const chartRef = useRef<HTMLDivElement>(null)
  const [topics, setTopics] = useState<Topic[]>([])
  const [docs, setDocs] = useState<DocEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [nTopics, setNTopics] = useState(5)
  const [method, setMethod] = useState<TopicMethod>('lda')
  const [methodError, setMethodError] = useState<string | null>(null)
  const [hoveredMethod, setHoveredMethod] = useState<TopicMethod | null>(null)
  const [activeTopic, setActiveTopic] = useState<number | null>(null)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  // Export popover state
  const [exportOpen, setExportOpen] = useState(false)
  const [exportIds, setExportIds] = useState<Set<number>>(new Set())
  const [exportScatter, setExportScatter] = useState(true)
  const [exportName, setExportName] = useState('')
  const [exportFormat, setExportFormat] = useState<ImageFormat>('png')
  const exportRef = useRef<HTMLDivElement>(null)

  // Close popover on outside click
  useEffect(() => {
    if (!exportOpen) return
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [exportOpen])

  const handleExportOpen = useCallback(() => {
    setExportOpen((v) => !v)
    setExportIds(new Set(topics.map((tp) => tp.id)))
    setExportScatter(true)
    setExportFormat('png')
    setExportName('topics.png')
  }, [topics])

  const handleExportSave = useCallback(() => {
    if (!chartRef.current) return
    const svgs: SVGSVGElement[] = []
    const labels: string[] = []

    // Collect selected topic bar chart SVGs
    for (const id of Array.from(exportIds).sort((a, b) => a - b)) {
      const el = chartRef.current.querySelector(`[data-topic-id="${id}"] svg`) as SVGSVGElement | null
      if (el) {
        const topic = topics.find((tp) => tp.id === id)
        svgs.push(el)
        labels.push(topic ? `T${id + 1}: ${topic.label}` : `T${id + 1}`)
      }
    }

    // Collect scatter SVG if selected
    if (exportScatter) {
      const el = chartRef.current.querySelector('[data-chart="scatter"] svg') as SVGSVGElement | null
      if (el) {
        svgs.push(el)
        labels.push(t('topics.scatter'))
      }
    }

    if (svgs.length === 0) return
    const ext = `.${exportFormat}`
    const fname = exportName.trim() || `topics${ext}`
    exportMultipleSvgs(svgs, labels, fname.endsWith(ext) ? fname : fname.replace(/\.\w+$/, '') + ext, exportFormat)
    setExportOpen(false)
  }, [chartRef, exportIds, exportScatter, exportName, exportFormat, topics, t])

  const fetchTopics = useCallback(() => {
    if (!text) return
    setLoading(true)
    setMethodError(null)
    apiFetch('/api/topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, n_topics: nTopics, top_n_words: 10, method }),
    })
      .then((r) => {
        if (r.status === 501) {
          setMethodError(t('topics.bertopicNotInstalled'))
          setTopics([])
          setDocs([])
          return null
        }
        return r.json()
      })
      .then((data) => {
        if (!data) return
        setTopics(data.topics || [])
        setDocs(data.documents || [])
        setActiveTopic(null)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [text, nTopics, method, t])

  useEffect(() => { fetchTopics() }, [fetchTopics])

  // Build scatter data: x = sentence_index, y = dominant_topic probability
  const scatterData = docs.map((d) => ({
    x: d.sentence_index,
    y: d.distribution[d.dominant_topic] ?? 0,
    topic: d.dominant_topic,
    snippet: d.snippet,
  }))

  const filteredScatter = activeTopic !== null
    ? scatterData.filter((d) => d.topic === activeTopic)
    : scatterData

  return (
    <div className="flex flex-col h-full">
      {/* Controls */}
      <div className="relative">
      <div className="flex items-center gap-3 px-4 py-2 border-b border-white/10 shrink-0 flex-wrap">
        <div className="flex items-center gap-1">
          {(['lda', 'nmf', 'bertopic'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              onMouseEnter={() => setHoveredMethod(m)}
              onMouseLeave={() => setHoveredMethod(null)}
              className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                method === m ? 'bg-white/15 text-white border-white/30' : 'border-white/15 text-white/40 hover:bg-white/5'
              }`}
            >
              {t(`topics.${m}` as const)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-1.5 text-xs text-white/40">
          {t('topics.topics')}
          <select
            value={nTopics}
            onChange={(e) => setNTopics(Number(e.target.value))}
            className="border border-white/15 rounded px-1.5 py-0.5 text-xs bg-white/8 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/30"
          >
            {[3, 4, 5, 6, 7, 8, 10].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        {topics.length > 0 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTopic(null)}
              className={`text-[10px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors ${
                activeTopic === null ? 'bg-white/15 text-white border-white/30' : 'border-white/15 text-white/40 hover:bg-white/5'
              }`}
            >{t('topics.all')}</button>
            {topics.map((tp) => (
              <button
                key={tp.id}
                onClick={() => setActiveTopic(activeTopic === tp.id ? null : tp.id)}
                className="text-[10px] px-2 py-0.5 rounded-full border cursor-pointer transition-colors"
                style={{
                  borderColor: EMO_COLORS[tp.id % EMO_COLORS.length],
                  color: activeTopic === tp.id ? 'white' : EMO_COLORS[tp.id % EMO_COLORS.length],
                  backgroundColor: activeTopic === tp.id ? EMO_COLORS[tp.id % EMO_COLORS.length] : 'transparent',
                }}
              >
                T{tp.id + 1}
              </button>
            ))}
          </div>
        )}
        {topics.length > 0 && (
          <div className="ml-auto relative shrink-0" ref={exportRef}>
            <button
              onClick={handleExportOpen}
              className="btn-glow flex items-center gap-1 text-[11px] border border-white/15 text-white/40 hover:text-white/70 px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title={t('export.save')}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 10v6m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              </svg>
              IMG
            </button>
            {exportOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--dropdown-bg)] border border-white/15 rounded-lg shadow-xl z-50 p-3 dropdown-glow">
                {/* Chart selection */}
                <label className="text-[10px] text-white/40 mb-1.5 block">{t('topics.exportSelect')}</label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {/* All toggle */}
                  <button
                    onClick={() => {
                      const allSelected = topics.every((tp) => exportIds.has(tp.id)) && exportScatter
                      if (allSelected) {
                        setExportIds(new Set())
                        setExportScatter(false)
                      } else {
                        setExportIds(new Set(topics.map((tp) => tp.id)))
                        setExportScatter(true)
                      }
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                      topics.every((tp) => exportIds.has(tp.id)) && exportScatter
                        ? 'bg-violet-500/30 border-violet-400/50 text-violet-300'
                        : 'border-white/15 text-white/40 hover:bg-white/5'
                    }`}
                  >{t('topics.selectAll')}</button>
                  {/* Per-topic */}
                  {topics.map((tp) => (
                    <button
                      key={tp.id}
                      onClick={() => setExportIds((prev) => {
                        const next = new Set(prev)
                        if (next.has(tp.id)) next.delete(tp.id); else next.add(tp.id)
                        return next
                      })}
                      className={`text-[10px] px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                        exportIds.has(tp.id)
                          ? 'bg-violet-500/30 border-violet-400/50 text-violet-300'
                          : 'border-white/15 text-white/40 hover:bg-white/5'
                      }`}
                    >T{tp.id + 1}</button>
                  ))}
                  {/* Scatter */}
                  <button
                    onClick={() => setExportScatter((v) => !v)}
                    className={`text-[10px] px-2 py-0.5 rounded border cursor-pointer transition-colors ${
                      exportScatter
                        ? 'bg-violet-500/30 border-violet-400/50 text-violet-300'
                        : 'border-white/15 text-white/40 hover:bg-white/5'
                    }`}
                  >{t('topics.scatter')}</button>
                </div>
                {/* Filename */}
                <label className="text-[10px] text-white/40 mb-1.5 block">{t('export.filename')}</label>
                <input
                  type="text"
                  value={exportName}
                  onChange={(e) => setExportName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleExportSave() }}
                  className="w-full text-xs px-2.5 py-1.5 rounded-md bg-white/8 border border-white/10 text-white/80 placeholder:text-white/30 outline-none focus:border-violet-400/50"
                  autoFocus
                />
                {/* Format */}
                <label className="text-[10px] text-white/40 mt-2 mb-1.5 block">{t('export.format')}</label>
                <div className="flex gap-1.5">
                  {(['png', 'jpg', 'svg'] as const).map((f) => (
                    <button
                      key={f}
                      onClick={() => {
                        setExportFormat(f)
                        setExportName((prev) => prev.replace(/\.\w+$/, '') + `.${f}`)
                      }}
                      className={`flex-1 text-[11px] px-2 py-1 rounded-md border cursor-pointer transition-colors ${
                        exportFormat === f
                          ? 'bg-violet-500/30 border-violet-400/50 text-violet-300 font-medium'
                          : 'border-white/10 text-white/40 hover:bg-white/5'
                      }`}
                    >{f.toUpperCase()}</button>
                  ))}
                </div>
                {/* Save */}
                <button
                  onClick={handleExportSave}
                  disabled={exportIds.size === 0 && !exportScatter}
                  className="mt-2.5 w-full text-xs text-white/70 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/30 px-3 py-1.5 rounded-md transition-colors cursor-pointer font-medium disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {t('export.save')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Method description tooltip */}
      {hoveredMethod && (
        <div className="absolute left-2 top-full mt-0.5 z-50 max-w-xs px-3 py-2 rounded-lg text-[11px] leading-relaxed bg-[var(--dropdown-bg)] border border-white/15 shadow-xl dropdown-glow text-white/70 pointer-events-none"
             style={{ animation: 'fade-in-up 0.15s ease-out both' }}>
          {t(`topics.${hoveredMethod}.desc` as any)}
        </div>
      )}
      </div>

      {methodError && (
        <div className="px-4 py-2 text-xs text-amber-400 bg-amber-400/10 border-b border-amber-400/20">
          {methodError}
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-violet-500 border-r-transparent" />
        </div>
      ) : topics.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-white/20 text-sm">
          {!methodError && t('topics.noData')}
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex" ref={chartRef}>
          {/* Left: Topic word bars */}
          <div className="w-[45%] overflow-y-auto border-r border-white/10 p-2 space-y-2">
            {(activeTopic !== null ? topics.filter((tp) => tp.id === activeTopic) : topics).map((topic) => (
              <div key={topic.id} data-topic-id={topic.id}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: EMO_COLORS[topic.id % EMO_COLORS.length] }}
                  />
                  <span className="text-[11px] font-semibold text-white/60">{topic.label}</span>
                </div>
                <div style={{ height: Math.max(60, topic.words.length * 18) }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={topic.words}
                      layout="vertical"
                      margin={{ top: 0, right: 8, bottom: 0, left: 2 }}
                    >
                      <XAxis type="number" hide />
                      <YAxis
                        type="category"
                        dataKey="word"
                        width={60}
                        tick={{ fontSize: 10, fill: 'var(--chart-tick)' }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          fontSize: 11,
                          borderRadius: 8,
                          border: '1px solid var(--chart-tooltip-border)',
                          backgroundColor: 'var(--chart-bg)',
                          backdropFilter: 'blur(12px)',
                          color: 'var(--chart-text)',
                        }}
                        formatter={(v: number | undefined) => [(v ?? 0).toFixed(2), t('topics.weight')]}
                      />
                      <Bar
                        dataKey="weight"
                        radius={[0, 3, 3, 0]}
                        cursor="pointer"
                        onClick={(d: any) => { if (d?.word) onSelectWord(d.word) }}
                      >
                        {topic.words.map((w, i) => (
                          <Cell
                            key={i}
                            fill={w.word === selectedWord
                              ? '#fbbf24'
                              : EMO_COLORS[topic.id % EMO_COLORS.length]}
                            opacity={w.word === selectedWord ? 1 : 0.7}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Document scatter */}
          <div className="flex-1 p-2 flex flex-col min-h-0" data-chart="scatter">
            <p className="text-[10px] text-white/30 mb-1 shrink-0 px-1">
              {t('topics.scatterDesc')}
            </p>
            <div className="flex-1 min-h-0">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis
                    type="number" dataKey="x" name="Sentence"
                    tick={{ fontSize: 10, fill: 'var(--chart-tick)' }} axisLine={{ stroke: 'var(--chart-axis)' }}
                  >
                    <Label value={t('topics.sentence')} position="insideBottom" offset={-5} style={{ fontSize: 10, fill: 'var(--chart-tick)' }} />
                  </XAxis>
                  <YAxis
                    type="number" dataKey="y" name="Confidence" domain={[0, 1]}
                    tick={{ fontSize: 10, fill: 'var(--chart-tick)' }} axisLine={{ stroke: 'var(--chart-axis)' }}
                    width={30}
                  >
                    <Label value={t('topics.confidence')} angle={-90} position="insideLeft" offset={10} style={{ fontSize: 10, fill: 'var(--chart-tick)' }} />
                  </YAxis>
                  <ZAxis range={[30, 30]} />
                  <Tooltip
                    cursor={{ strokeDasharray: '3 3' }}
                    content={({ payload }) => {
                      if (!payload?.length) return null
                      const d = payload[0].payload
                      return (
                        <div className="bg-[var(--chart-bg)] border rounded-lg px-3 py-2 text-xs backdrop-blur-xl max-w-64 text-emo-text" style={{ borderColor: 'var(--chart-tooltip-border)' }}>
                          <div className="font-semibold mb-0.5">
                            Topic {d.topic + 1} &middot; {(d.y * 100).toFixed(0)}%
                          </div>
                          <div className="text-white/40 truncate">{d.snippet}</div>
                        </div>
                      )
                    }}
                  />
                  <Scatter
                    data={filteredScatter}
                    cursor="pointer"
                    shape={(props: any) => {
                      const { cx, cy, payload } = props
                      if (cx == null || cy == null) return null
                      const idx = filteredScatter.indexOf(payload)
                      const color = EMO_COLORS[payload.topic % EMO_COLORS.length]
                      const isHovered = hoveredIdx === idx
                      const isDimmed = hoveredIdx !== null && !isHovered

                      return (
                        <g
                          onMouseEnter={() => setHoveredIdx(idx)}
                          onMouseLeave={() => setHoveredIdx(null)}
                        >
                          {isHovered && <circle cx={cx} cy={cy} r={14} fill={color} opacity={0.2} />}
                          <circle cx={cx} cy={cy} r={4} fill={color} opacity={isDimmed ? 0.12 : 0.8} />
                          <text
                            x={cx} y={cy - 7}
                            textAnchor="middle" fontSize={8} fill={color}
                            stroke="var(--color-emo-bg)" strokeWidth={2.5} paintOrder="stroke"
                            opacity={isDimmed ? 0.06 : isHovered ? 1 : 0.5}
                            fontWeight={isHovered ? 600 : 400}
                            style={{ pointerEvents: 'none' }}
                          >
                            T{payload.topic + 1}
                          </text>
                        </g>
                      )
                    }}
                  />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
