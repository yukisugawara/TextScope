import { useState, useMemo } from 'react'
import { useLocale } from '../i18n'
import type { Document } from '../App'

interface Props {
  documents: Document[]
  selectedWord: string
  onSelectWord: (word: string) => void
}

type FilterMode = 'all' | 'shared' | 'unique'
type SortKey = 'word' | 'pos' | 'diff'
type SortDir = 'asc' | 'desc'

interface MergedRow {
  word: string
  pos: string
  counts: Record<string, number>  // docId → count
  diff: number
}

export default function ComparePanel({ documents, selectedWord, onSelectWord }: Props) {
  const { t } = useLocale()

  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set(documents.map(d => d.id)))
  const [filter, setFilter] = useState<FilterMode>('all')
  const [sortKey, setSortKey] = useState<SortKey>('diff')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  // Keep checkedIds in sync when documents change
  const selectedDocs = useMemo(
    () => documents.filter(d => checkedIds.has(d.id)),
    [documents, checkedIds]
  )

  const toggleDoc = (id: string) => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Merge frequencies across selected documents
  const mergedRows = useMemo<MergedRow[]>(() => {
    if (selectedDocs.length < 2) return []

    const map = new Map<string, MergedRow>()

    for (const doc of selectedDocs) {
      for (const f of doc.frequencies) {
        const key = `${f.word}\t${f.pos}`
        let row = map.get(key)
        if (!row) {
          row = { word: f.word, pos: f.pos, counts: {}, diff: 0 }
          map.set(key, row)
        }
        row.counts[doc.id] = f.count
      }
    }

    // Compute diff = max - min across selected docs
    for (const row of map.values()) {
      const vals = selectedDocs.map(d => row.counts[d.id] ?? 0)
      row.diff = Math.max(...vals) - Math.min(...vals)
    }

    return Array.from(map.values())
  }, [selectedDocs])

  // Filter
  const filteredRows = useMemo(() => {
    if (filter === 'all') return mergedRows

    return mergedRows.filter(row => {
      const presentIn = selectedDocs.filter(d => (row.counts[d.id] ?? 0) > 0).length
      if (filter === 'shared') return presentIn === selectedDocs.length
      if (filter === 'unique') return presentIn === 1
      return true
    })
  }, [mergedRows, filter, selectedDocs])

  // Sort
  const sortedRows = useMemo(() => {
    const rows = [...filteredRows]
    const dir = sortDir === 'asc' ? 1 : -1

    rows.sort((a, b) => {
      if (sortKey === 'word') return dir * a.word.localeCompare(b.word)
      if (sortKey === 'pos') return dir * a.pos.localeCompare(b.pos)
      return dir * (a.diff - b.diff)
    })

    return rows
  }, [filteredRows, sortKey, sortDir])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'word' || key === 'pos' ? 'asc' : 'desc')
    }
  }

  const sortIndicator = (key: SortKey) => {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' \u25b2' : ' \u25bc'
  }

  // CSV download
  const downloadCsv = () => {
    const header = ['Word', 'POS', ...selectedDocs.map(d => d.filename), 'Diff'].join(',')
    const lines = sortedRows.map(row =>
      [
        `"${row.word}"`,
        `"${row.pos}"`,
        ...selectedDocs.map(d => row.counts[d.id] ?? 0),
        row.diff,
      ].join(',')
    )
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'compare.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (documents.length < 2) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-white/30 text-sm">{t('compare.noDocs')}</p>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Controls */}
      <div className="shrink-0 px-3 py-2 border-b border-white/10 flex items-center gap-3 flex-wrap">
        {/* Document checkboxes */}
        <span className="text-[11px] text-white/40 mr-1">{t('compare.selectDocs')}:</span>
        {documents.map(doc => (
          <label key={doc.id} className="flex items-center gap-1 text-[11px] cursor-pointer">
            <input
              type="checkbox"
              checked={checkedIds.has(doc.id)}
              onChange={() => toggleDoc(doc.id)}
              className="accent-violet-500"
            />
            <span className={checkedIds.has(doc.id) ? 'text-white/70' : 'text-white/30'}>
              {doc.filename}
            </span>
          </label>
        ))}

        <div className="flex-1" />

        {/* Filter pills */}
        {([['all', t('compare.all')], ['shared', t('compare.shared')], ['unique', t('compare.unique')]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
              filter === key
                ? 'bg-violet-500/20 text-violet-300 border border-violet-400/30'
                : 'text-white/30 border border-white/10 hover:text-white/50'
            }`}
          >
            {label}
          </button>
        ))}

        {/* CSV button */}
        <button
          onClick={downloadCsv}
          className="px-2 py-0.5 rounded text-[10px] font-medium text-white/30 border border-white/10 hover:text-white/50 transition-colors cursor-pointer"
        >
          {t('compare.csv')}
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-auto">
        {selectedDocs.length < 2 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-white/30 text-sm">{t('compare.noDocs')}</p>
          </div>
        ) : (
          <table className="w-full text-[11px]">
            <thead className="sticky top-0 bg-[var(--card-bg)] z-10">
              <tr className="border-b border-white/10">
                <th
                  onClick={() => handleSort('word')}
                  className="text-left px-3 py-1.5 text-white/50 font-semibold cursor-pointer hover:text-white/70 select-none"
                >
                  Word{sortIndicator('word')}
                </th>
                <th
                  onClick={() => handleSort('pos')}
                  className="text-left px-2 py-1.5 text-white/50 font-semibold cursor-pointer hover:text-white/70 select-none"
                >
                  POS{sortIndicator('pos')}
                </th>
                {selectedDocs.map(doc => (
                  <th key={doc.id} className="text-right px-2 py-1.5 text-white/50 font-semibold">
                    <span className="truncate max-w-24 inline-block" title={doc.filename}>{doc.filename}</span>
                  </th>
                ))}
                <th
                  onClick={() => handleSort('diff')}
                  className="text-right px-3 py-1.5 text-white/50 font-semibold cursor-pointer hover:text-white/70 select-none"
                >
                  {t('compare.diff')}{sortIndicator('diff')}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr
                  key={`${row.word}\t${row.pos}`}
                  onClick={() => onSelectWord(row.word)}
                  className={`border-b border-white/5 cursor-pointer transition-colors ${
                    row.word === selectedWord
                      ? 'bg-violet-500/15 text-violet-200'
                      : 'hover:bg-white/5'
                  }`}
                >
                  <td className="px-3 py-1 text-white/80 font-medium">{row.word}</td>
                  <td className="px-2 py-1 text-white/40">{row.pos}</td>
                  {selectedDocs.map(doc => (
                    <td key={doc.id} className="text-right px-2 py-1 text-white/60 tabular-nums">
                      {row.counts[doc.id] ?? 0}
                    </td>
                  ))}
                  <td className="text-right px-3 py-1 text-white/40 tabular-nums">{row.diff}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Status bar */}
      <div className="shrink-0 px-3 py-1 border-t border-white/10 text-[10px] text-white/30">
        {sortedRows.length} words
      </div>
    </div>
  )
}
