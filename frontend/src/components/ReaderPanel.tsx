import { useMemo } from 'react'
import { useLocale } from '../i18n'

interface Props {
  text: string
  filename: string
  charCount: number
  highlightWord: string
  language: string
}

interface Segment {
  text: string
  highlight: boolean
}

function splitByKeyword(text: string, keyword: string, lang: string): Segment[] {
  if (!keyword) return [{ text, highlight: false }]

  const flags = lang === 'en' ? 'gi' : 'g'
  const pattern = new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, flags)
  const parts = text.split(pattern)

  return parts
    .filter((p) => p.length > 0)
    .map((p) => ({
      text: p,
      highlight: lang === 'en'
        ? p.toLowerCase() === keyword.toLowerCase()
        : p === keyword,
    }))
}

export default function ReaderPanel({ text, filename, charCount, highlightWord, language }: Props) {
  const { t } = useLocale()
  const segments = useMemo(
    () => splitByKeyword(text, highlightWord, language),
    [text, highlightWord, language],
  )

  return (
    <div className="overflow-hidden flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 shrink-0">
        <span className="text-xs font-semibold text-white/30 uppercase tracking-wider">{t('reader.title')}</span>
      </div>
      <div className="overflow-y-auto flex-1 p-4 text-[13px] leading-relaxed whitespace-pre-wrap break-words font-mono text-white/55">
        {segments.map((seg, i) =>
          seg.highlight ? (
            <mark key={i} className="bg-amber-400/20 text-amber-300 rounded-sm px-0.5 py-px">{seg.text}</mark>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </div>
    </div>
  )
}
