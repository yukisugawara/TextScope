import { useState, useRef, useEffect } from 'react'
import { useLocale } from '../i18n'

interface KwicLine {
  left: string
  keyword: string
  right: string
  position: number
}

interface Props {
  keyword: string
  lines: KwicLine[]
  loading: boolean
}

function saveCsv(lines: KwicLine[], filename: string) {
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`
  const rows = [
    'Left,Key Word,Right',
    ...lines.map((l) => `${escape(l.left)},${escape(l.keyword)},${escape(l.right)}`),
  ]
  const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export default function KwicPanel({ keyword, lines, loading }: Props) {
  const { t } = useLocale()

  // Save-as popover state
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
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
    const fallback = `kwic_${keyword}.csv`
    const name = saveName.trim() || fallback
    saveCsv(lines, name.endsWith('.csv') ? name : name + '.csv')
    setSaveOpen(false)
  }

  if (!keyword) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-2.5 border-b border-white/8 shrink-0">
          <span className="text-xs font-semibold text-white/30 uppercase tracking-wider">{t('kwic.concordance')}</span>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 text-white/20 text-sm">
          {t('kwic.selectWord')}
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/8 shrink-0">
        <span className="text-xs font-semibold text-white/30 uppercase tracking-wider">{t('kwic.title')}</span>
        <span className="text-[11px] bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full font-semibold">
          {keyword}
        </span>
        <span className="text-[11px] text-white/30">{lines.length} {t('kwic.hits')}</span>
        {lines.length > 0 && (
          <div className="ml-auto relative shrink-0" ref={saveRef}>
            <button
              onClick={() => { setSaveOpen(!saveOpen); setSaveName(`kwic_${keyword}.csv`) }}
              className="btn-glow flex items-center gap-1 text-[11px] border border-white/15 text-white/40 hover:text-white/70 px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              title={t('kwic.saveAs')}
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M12 10v6m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
              </svg>
              CSV
            </button>
            {saveOpen && (
              <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--dropdown-bg)] border border-white/15 rounded-lg shadow-xl z-50 p-3 dropdown-glow">
                <label className="text-[10px] text-white/40 mb-1.5 block">{t('kwic.filename')}</label>
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
                  {t('kwic.save')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="h-6 w-6 animate-spin rounded-full border-[3px] border-violet-500 border-r-transparent" />
        </div>
      ) : lines.length === 0 ? (
        <div className="flex-1 flex items-center justify-center p-8 text-white/20 text-sm">
          {t('kwic.noMatches')}
        </div>
      ) : (
        <div className="overflow-y-auto flex-1 font-mono text-[12px] leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className="flex px-4 py-1 hover:bg-white/5 border-b border-white/5 items-baseline">
              <span
                className="text-white/40 whitespace-pre overflow-hidden text-ellipsis flex-1 min-w-0"
                style={{ direction: 'rtl', textAlign: 'right' }}
              >
                <bdi>{line.left}</bdi>
              </span>
              <span className="mx-1 font-bold text-amber-400 bg-amber-400/15 px-1 rounded shrink-0">
                {line.keyword}
              </span>
              <span className="text-left text-white/40 whitespace-pre overflow-hidden text-ellipsis flex-1 min-w-0">
                {line.right}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
