import { useState, useRef, useEffect } from 'react'
import { useLocale } from '../i18n'

interface FreqItem {
  word: string
  pos: string
  count: number
}

interface TfidfItem {
  word: string
  pos: string
  score: number
}

type ScoreMode = 'count' | 'tfidf'

interface Props {
  frequencies: FreqItem[]
  language: string
  selectedWord: string
  onSelectWord: (word: string) => void
  onDownloadCsv: (filename: string) => void
  trackedWords: string[]
  onToggleTrack: (word: string) => void
  scoreMode: ScoreMode
  onToggleScoreMode: () => void
  tfidfData: TfidfItem[]
}

function posBadge(pos: string) {
  const style =
    pos === 'Noun' || pos === 'Proper Noun'
      ? { background: 'var(--accent-emerald-bg)', color: 'var(--accent-emerald)' }
      : pos === 'Verb'
        ? { background: 'var(--accent-violet-bg)', color: 'var(--accent-violet)' }
        : pos === 'Adjective'
          ? { background: 'var(--accent-amber-bg)', color: 'var(--accent-amber)' }
          : { background: 'var(--accent-muted-bg)', color: 'var(--accent-muted)' }
  return <span className="text-xs px-2 py-0.5 rounded-full" style={style}>{pos}</span>
}

export default function FrequencyTable({
  frequencies, language, selectedWord, onSelectWord, onDownloadCsv,
  trackedWords, onToggleTrack, scoreMode, onToggleScoreMode, tfidfData,
}: Props) {
  const { t } = useLocale()
  const displayData = scoreMode === 'tfidf' ? tfidfData : null

  // Save-as popover state
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('frequencies.csv')
  const saveRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!saveOpen) return
    const handler = (e: MouseEvent) => {
      if (saveRef.current && !saveRef.current.contains(e.target as Node)) setSaveOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [saveOpen])

  const handleSave = () => {
    const name = saveName.trim() || 'frequencies.csv'
    onDownloadCsv(name.endsWith('.csv') ? name : name + '.csv')
    setSaveOpen(false)
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header row 1: title + save */}
      <div className="flex items-center justify-between px-4 pt-2 pb-1 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-white/70">{t('freq.title')}</span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-violet-bg)', color: 'var(--accent-violet)' }}>
            {language === 'ja' ? 'JA' : 'EN'}
          </span>
          <span className="text-xs text-white/30">
            {scoreMode === 'tfidf' ? tfidfData.length : frequencies.length}
          </span>
        </div>
        {/* Save CSV dropdown */}
        <div className="relative shrink-0" ref={saveRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setSaveOpen(!saveOpen); setSaveName('frequencies.csv') }}
            className="btn-glow flex items-center gap-1 text-xs border border-white/15 text-white/50 px-2.5 py-1 rounded-lg hover:bg-white/10 hover:text-white/70 transition-colors cursor-pointer"
            title={t('freq.saveAs')}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 10v6m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
            </svg>
            CSV
          </button>
          {saveOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--dropdown-bg)] border border-white/15 rounded-lg shadow-xl z-50 p-3 dropdown-glow">
              <label className="text-[10px] text-white/40 mb-1.5 block">{t('freq.filename')}</label>
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
                className="w-full text-xs px-2.5 py-1.5 rounded-md bg-white/8 border border-white/10 text-white/80 placeholder:text-white/30 outline-none focus:border-violet-400/50"
                autoFocus
              />
              <button
                onClick={handleSave}
                className="mt-2 w-full text-xs text-white/70 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/30 px-3 py-1.5 rounded-md transition-colors cursor-pointer font-medium"
              >
                {t('freq.save')}
              </button>
            </div>
          )}
        </div>
      </div>
      {/* Header row 2: score mode toggle */}
      <div className="flex items-center gap-2 px-4 pb-2 border-b border-white/8 shrink-0">
        <div className="flex items-center rounded-full border border-white/15 overflow-hidden">
          <button
            onClick={(e) => { e.stopPropagation(); if (scoreMode !== 'count') onToggleScoreMode() }}
            className="text-[10px] px-2 py-0.5 font-semibold transition-colors cursor-pointer"
            style={scoreMode === 'count'
              ? { background: 'var(--accent-violet-bg)', color: 'var(--accent-violet)' }
              : { color: 'var(--accent-muted)' }}
          >
            {t('freq.count')}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (scoreMode !== 'tfidf') onToggleScoreMode() }}
            className="text-[10px] px-2 py-0.5 font-semibold transition-colors cursor-pointer"
            style={scoreMode === 'tfidf'
              ? { background: 'var(--accent-violet-bg)', color: 'var(--accent-violet)' }
              : { color: 'var(--accent-muted)' }}
          >
            {t('freq.tfidf')}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-y-auto flex-1">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-white/5 z-10">
            <tr className="text-left text-xs text-white/30 uppercase tracking-wider">
              <th className="px-3 py-2 font-medium">{t('freq.word')}</th>
              <th className="px-3 py-2 font-medium">{t('freq.pos')}</th>
              <th className="px-3 py-2 font-medium text-right">
                {scoreMode === 'tfidf' ? t('freq.tfidf') : t('freq.freq')}
              </th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {(displayData
              ? displayData.map((d) => ({ word: d.word, pos: d.pos, value: d.score }))
              : frequencies.map((f) => ({ word: f.word, pos: f.pos, value: f.count }))
            ).map((item, idx) => {
              const tracked = trackedWords.includes(item.word)
              return (
                <tr
                  key={`${idx}-${item.word}-${item.pos}`}
                  onClick={() => onSelectWord(item.word)}
                  className={`cursor-pointer transition-colors ${
                    selectedWord === item.word
                      ? 'bg-violet-500/10 hover:bg-violet-500/15'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <td className="px-3 py-1.5 font-medium"
                    style={{ color: selectedWord === item.word ? 'var(--accent-violet)' : undefined }}
                  >{item.word}</td>
                  <td className="px-3 py-1.5">{posBadge(item.pos)}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums text-white/50">
                    {scoreMode === 'tfidf' ? item.value.toFixed(4) : item.value}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleTrack(item.word) }}
                      title={tracked ? t('freq.removeFromTrends') : t('freq.addToTrends')}
                      className="p-0.5 rounded transition-colors cursor-pointer"
                      style={{ color: tracked ? 'var(--accent-violet)' : 'var(--accent-muted-bg)' }}
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M3 17l6-6 4 4 8-8" />
                      </svg>
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
