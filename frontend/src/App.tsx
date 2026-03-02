import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import IntroSplash from './components/IntroSplash'
import UploadZone from './components/UploadZone'
import FrequencyTable from './components/FrequencyTable'
import KwicPanel from './components/KwicPanel'
import ReaderPanel from './components/ReaderPanel'
import WordCloudPanel from './components/WordCloudPanel'
import TrendsPanel from './components/TrendsPanel'
import CooccurrencePanel from './components/CooccurrencePanel'
import CorrespondencePanel from './components/CorrespondencePanel'
import ClusterPanel from './components/ClusterPanel'
import TopicPanel from './components/TopicPanel'
import CodingPanel from './components/CodingPanel'
import Word2VecPanel from './components/Word2VecPanel'
import ComparePanel from './components/ComparePanel'
import type { CodingRule, ConceptResult } from './components/CodingPanel'
import { useLocale } from './i18n'
import { useTheme } from './theme'
import { apiFetch } from './api'

interface FreqItem { word: string; pos: string; count: number }
interface TfidfItem { word: string; pos: string; score: number }
interface KwicLine { left: string; keyword: string; right: string; position: number }
interface ConceptSeries { name: string; segmentCounts: number[] }
interface SampleItem { filename: string; label: string; label_ja?: string; description: string; description_ja?: string; type?: string }
interface SampleRecord { index: number; title: string; speaker: string; date: string }

export interface Document {
  id: string
  filename: string
  text: string
  charCount: number
  language: string
  frequencies: FreqItem[]
  tfidfData: TfidfItem[]
}

type ScoreMode = 'count' | 'tfidf'

type ActiveTab = 'kwic' | 'reader' | 'cloud' | 'trends' | 'cooccurrence' | 'correspondence' | 'cluster' | 'topics' | 'word2vec' | 'compare'
type SidebarTab = 'frequencies' | 'coding'

export default function App() {
  const { t, locale, setLocale } = useLocale()
  const { theme, toggleTheme } = useTheme()

  const [introComplete, setIntroComplete] = useState(() =>
    sessionStorage.getItem('textscope-intro-seen') === '1'
  )
  const handleIntroComplete = useCallback(() => {
    setIntroComplete(true)
    sessionStorage.setItem('textscope-intro-seen', '1')
  }, [])

  const TABS = useMemo<{ key: ActiveTab; label: string }[]>(() => [
    { key: 'reader',         label: t('tab.reader') },
    { key: 'kwic',           label: t('tab.kwic') },
    { key: 'cloud',          label: t('tab.cloud') },
    { key: 'trends',         label: t('tab.trends') },
    { key: 'cooccurrence',   label: t('tab.cooccurrence') },
    { key: 'correspondence', label: t('tab.correspondence') },
    { key: 'cluster',        label: t('tab.cluster') },
    { key: 'topics',         label: t('tab.topics') },
    { key: 'word2vec',       label: t('tab.word2vec') },
    { key: 'compare',        label: t('tab.compare') },
  ], [t])
  const SIDEBAR_TABS = useMemo<{ key: SidebarTab; label: string }[]>(() => [
    { key: 'frequencies', label: t('tab.frequencies') },
    { key: 'coding',      label: t('tab.coding') },
  ], [t])

  // --- multi-document state ---
  const [documents, setDocuments] = useState<Document[]>([])
  const [activeDocId, setActiveDocId] = useState<string | null>(null)

  // derived values for backward compatibility
  const activeDoc = documents.find(d => d.id === activeDocId) ?? null
  const text = activeDoc?.text ?? ''
  const filename = activeDoc?.filename ?? ''
  const charCount = activeDoc?.charCount ?? 0
  const frequencies = activeDoc?.frequencies ?? []
  const language = activeDoc?.language ?? ''
  const tfidfData = activeDoc?.tfidfData ?? []

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [scoreMode, setScoreMode] = useState<ScoreMode>('count')

  const [selectedWord, setSelectedWord] = useState('')
  const [kwicLines, setKwicLines] = useState<KwicLine[]>([])
  const [kwicLoading, setKwicLoading] = useState(false)

  const [trackedWords, setTrackedWords] = useState<string[]>([])
  const [activeTab, setActiveTab] = useState<ActiveTab>('reader')
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('frequencies')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [hoveredTab, setHoveredTab] = useState<string | null>(null)

  // --- resizable sidebar ---
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const isDragging = useRef(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const onDividerMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current || !bodyRef.current) return
      const rect = bodyRef.current.getBoundingClientRect()
      const newWidth = Math.min(Math.max(ev.clientX - rect.left, 200), rect.width * 0.6)
      setSidebarWidth(newWidth)
    }
    const onMouseUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  // --- coding ---
  const [codingRules, setCodingRules] = useState<CodingRule[]>([])
  const [conceptResults, setConceptResults] = useState<ConceptResult[]>([])
  const [codingRunning, setCodingRunning] = useState(false)
  const [trackedConcepts, setTrackedConcepts] = useState<string[]>([])

  // --- help modal ---
  const [helpOpen, setHelpOpen] = useState(false)

  // --- samples ---
  const [samples, setSamples] = useState<SampleItem[]>([])
  const [sampleMenuOpen, setSampleMenuOpen] = useState(false)
  const sampleMenuRef = useRef<HTMLDivElement>(null)

  // --- docbar add dropdown ---
  const [addMenuOpen, setAddMenuOpen] = useState(false)
  const addMenuRef = useRef<HTMLDivElement>(null)
  const addFileInputRef = useRef<HTMLInputElement>(null)

  // --- CSV sample record picker modal ---
  const [csvPickerFile, setCsvPickerFile] = useState<string | null>(null)
  const [recordCache, setRecordCache] = useState<Record<string, SampleRecord[]>>({})
  const [recordSearch, setRecordSearch] = useState('')

  useEffect(() => {
    apiFetch('/api/samples')
      .then((r) => r.json())
      .then(setSamples)
      .catch(() => {})
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    if (!sampleMenuOpen && !addMenuOpen) return
    const handler = (e: MouseEvent) => {
      if (sampleMenuOpen && sampleMenuRef.current && !sampleMenuRef.current.contains(e.target as Node)) {
        setSampleMenuOpen(false)
      }
      if (addMenuOpen && addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) {
        setAddMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [sampleMenuOpen, addMenuOpen])

  const conceptSeries = useMemo<ConceptSeries[]>(() =>
    trackedConcepts
      .map((name) => {
        const r = conceptResults.find((c) => c.concept === name)
        return r ? { name, segmentCounts: r.segment_counts } : null
      })
      .filter((x): x is ConceptSeries => x !== null),
    [trackedConcepts, conceptResults]
  )

  // --- helpers ---
  const displayFrequencies = useMemo<FreqItem[]>(() => {
    if (scoreMode === 'tfidf') {
      return tfidfData.map((d) => ({
        word: d.word,
        pos: d.pos,
        count: d.score * 10000,
      }))
    }
    return frequencies
  }, [scoreMode, frequencies, tfidfData])

  const fetchKwic = useCallback(async (keyword: string, sourceText: string) => {
    setKwicLoading(true)
    try {
      const contextWords = language === 'ja' ? 50 : 30
      const res = await apiFetch('/api/kwic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: sourceText, keyword, context_words: contextWords }),
      })
      if (!res.ok) throw new Error('KWIC search failed')
      setKwicLines((await res.json()).results)
    } catch {
      setKwicLines([])
    } finally {
      setKwicLoading(false)
    }
  }, [language])

  const runCoding = useCallback(async () => {
    if (!text || codingRules.length === 0) return
    setCodingRunning(true)
    try {
      const res = await apiFetch('/api/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, rules: codingRules, segments: 10 }),
      })
      if (!res.ok) throw new Error('Coding failed')
      const data = await res.json()
      setConceptResults(data.results)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Coding error')
    } finally {
      setCodingRunning(false)
    }
  }, [text, codingRules])

  // --- document management ---
  const addDocument = useCallback(async (docText: string, docFilename: string, docLength: number) => {
    const id = crypto.randomUUID()

    // Fetch frequencies
    const freqRes = await apiFetch('/api/frequencies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: docText }),
    })
    if (!freqRes.ok) throw new Error('Frequency analysis failed')
    const freqData = await freqRes.json()

    // Fetch tfidf (non-blocking failure)
    let tfidf: TfidfItem[] = []
    try {
      const tfidfRes = await apiFetch('/api/tfidf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: docText }),
      })
      if (tfidfRes.ok) {
        const tfidfBody = await tfidfRes.json()
        tfidf = tfidfBody.tfidf
      }
    } catch { /* ignore */ }

    const newDoc: Document = {
      id,
      filename: docFilename,
      text: docText,
      charCount: docLength,
      language: freqData.language,
      frequencies: freqData.frequencies,
      tfidfData: tfidf,
    }

    setDocuments(prev => [...prev, newDoc])
    setActiveDocId(id)
  }, [])

  const removeDocument = useCallback((id: string) => {
    setDocuments(prev => {
      const next = prev.filter(d => d.id !== id)
      // Adjust active doc
      setActiveDocId(cur => {
        if (cur !== id) return cur
        return next.length > 0 ? next[0].id : null
      })
      return next
    })
  }, [])

  const switchDocument = useCallback((id: string) => {
    setActiveDocId(id)
    setSelectedWord('')
    setKwicLines([])
  }, [])

  const resetAll = useCallback(() => {
    setDocuments([])
    setActiveDocId(null)
    setScoreMode('count')
    setSelectedWord(''); setKwicLines([])
    setTrackedWords([]); setActiveTab('reader'); setSidebarTab('frequencies'); setSidebarOpen(true)
    setCodingRules([]); setConceptResults([]); setTrackedConcepts([])
    setError('')
  }, [])

  const upload = useCallback(async (file: File) => {
    setLoading(true)
    setError('')

    const form = new FormData()
    form.append('file', file)
    try {
      const res = await apiFetch('/api/upload', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.detail ?? `Upload failed (${res.status})`)
      }
      const data = await res.json()
      await addDocument(data.text, data.filename, data.length)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [addDocument])

  const loadSample = useCallback(async (sampleFilename: string) => {
    setSampleMenuOpen(false)
    setAddMenuOpen(false)
    setLoading(true)
    setError('')

    try {
      const res = await apiFetch(`/api/samples/${encodeURIComponent(sampleFilename)}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.detail ?? `Failed to load sample (${res.status})`)
      }
      const data = await res.json()
      await addDocument(data.text, data.filename, data.length)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [addDocument])

  const openCsvPicker = useCallback((filename: string) => {
    setSampleMenuOpen(false)
    setAddMenuOpen(false)
    setCsvPickerFile(filename)
    setRecordSearch('')
    // Fetch records if not cached
    if (!recordCache[filename]) {
      apiFetch(`/api/samples/${encodeURIComponent(filename)}/records`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) setRecordCache(prev => ({ ...prev, [filename]: data.records })) })
        .catch(() => {})
    }
  }, [recordCache])

  const loadSampleRecord = useCallback(async (sampleFilename: string, recordIndex: number) => {
    setCsvPickerFile(null)
    setRecordSearch('')
    setLoading(true)
    setError('')

    try {
      const res = await apiFetch(`/api/samples/${encodeURIComponent(sampleFilename)}?record=${recordIndex}`)
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.detail ?? `Failed to load record (${res.status})`)
      }
      const data = await res.json()
      await addDocument(data.text, data.filename, data.length)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [addDocument])

  const handleSelectWord = useCallback((word: string) => {
    const next = word === selectedWord ? '' : word
    setSelectedWord(next)
    if (next) {
      fetchKwic(next, text)
    } else {
      setKwicLines([])
    }
  }, [selectedWord, text, fetchKwic])

  const handleToggleTrack = useCallback((word: string) => {
    setTrackedWords((p) => p.includes(word) ? p.filter((w) => w !== word) : [...p, word])
  }, [])

  const handleToggleTrackConcept = useCallback((name: string) => {
    setTrackedConcepts((p) => p.includes(name) ? p.filter((n) => n !== name) : [...p, name])
  }, [])

  const downloadCsv = useCallback(async (filename: string) => {
    try {
      const res = await apiFetch('/api/frequencies/csv', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (!res.ok) throw new Error('CSV export failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'CSV export error')
    }
  }, [text])

  // Format file size for display
  const formatSize = (count: number) => {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
    if (count >= 1_000) return `${(count / 1_000).toFixed(0)}K`
    return `${count}`
  }

  // ============================
  // Landing page
  // ============================
  const PARTICLE_COUNT = 18

  if (documents.length === 0 && !loading) {
    if (!introComplete) {
      return <IntroSplash onComplete={handleIntroComplete} t={t} />
    }
    return (
      <div className="min-h-screen bg-emo-bg text-emo-text flex flex-col relative overflow-hidden"
           style={{ animation: 'curtain-reveal 0.6s ease-out both' }}>

        {/* ── Animated orbs ── */}
        <div className="landing-orb landing-orb-1" />
        <div className="landing-orb landing-orb-2" />
        <div className="landing-orb landing-orb-3" />

        {/* ── Rising particles ── */}
        {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
          <div
            key={i}
            className="landing-particle"
            style={{
              left: `${(i / PARTICLE_COUNT) * 100 + Math.sin(i * 1.8) * 5}%`,
              background: ['#a855f7', '#ec4899', '#2dd4bf'][i % 3],
              animationDuration: `${4 + (i % 5) * 1.5}s`,
              animationDelay: `${1.5 + i * 0.35}s`,
              width: `${2 + (i % 3)}px`,
              height: `${2 + (i % 3)}px`,
            }}
          />
        ))}

        {/* ── Top-right controls ── */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2"
             style={{ animation: 'fade-in-up 0.5s ease-out 2s both' }}>
          <button
            onClick={toggleTheme}
            className="text-white/40 hover:text-white border border-white/15 p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="5" />
                <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setLocale(locale === 'en' ? 'ja' : 'en')}
            className="text-[11px] text-white/40 hover:text-white border border-white/15 px-2.5 py-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer font-semibold"
          >
            {locale === 'en' ? 'JA' : 'EN'}
          </button>
        </div>

        {/* ── Hero title ── */}
        <header className="flex-1 flex items-end justify-center px-8 pb-6 relative z-10">
          <div className="max-w-lg mx-auto text-center relative" style={{ perspective: '600px' }}>
            {/* Expanding rings */}
            <div className="title-ring" />
            <div className="title-ring title-ring-2" />
            <div className="title-ring title-ring-3" />

            <h1
              className="text-7xl font-extrabold tracking-tight bg-gradient-to-r from-violet-400 via-pink-400 to-teal-400 relative z-10"
              style={{
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                opacity: 0,
                animation: 'title-fade-in 1s ease-out 0.3s forwards, shimmer-sweep 3s ease-in-out 2s 1',
                backgroundSize: '200% 100%',
              }}
            >
              TextScope
            </h1>
            <p className="text-white/45 mt-3 text-sm tracking-wide"
               style={{ animation: 'subtitle-in 0.8s cubic-bezier(0.22,1,0.36,1) 1.2s both' }}>
              {t('app.subtitle')}
            </p>
          </div>
        </header>

        {/* ── Upload + samples ── */}
        <main className="flex-1 flex items-start justify-center px-6 pt-8 relative z-10">
          <div className="w-full max-w-lg space-y-4">
            <div style={{ animation: 'section-up 0.7s cubic-bezier(0.22,1,0.36,1) 1.5s both' }}>
              <UploadZone onUpload={upload} />
            </div>
            {error && <ErrorBanner message={error} />}
            <p className="text-center text-xs text-white/25"
               style={{ animation: 'section-up 0.6s cubic-bezier(0.22,1,0.36,1) 1.8s both' }}>
              {t('app.supportedFormats')}
            </p>

            {samples.length > 0 && (
              <div className="pt-2"
                   style={{ animation: 'section-up 0.6s cubic-bezier(0.22,1,0.36,1) 2s both' }}>
                <p className="text-center text-xs text-white/30 mb-3">{t('app.trySample')}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {samples.map((s, idx) => (
                    <button
                      key={s.filename}
                      onClick={() => (s.type === 'csv' || s.type === 'collection') ? openCsvPicker(s.filename) : loadSample(s.filename)}
                      className="text-[11px] text-white/50 hover:text-white border border-white/15 hover:border-white/30 px-3 py-1.5 rounded-lg hover:bg-white/8 transition-colors cursor-pointer flex items-center gap-1"
                      title={locale === 'ja' && s.description_ja ? s.description_ja : s.description}
                      style={{ animation: `btn-pop 0.4s cubic-bezier(0.22,1,0.36,1) ${2.2 + idx * 0.1}s both` }}
                    >
                      {locale === 'ja' && s.label_ja ? s.label_ja : s.label}
                      {(s.type === 'csv' || s.type === 'collection') && (
                        <svg className="w-3 h-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* ── Help button (bottom-left) ── */}
        <button
          onClick={() => setHelpOpen(true)}
          className="fixed bottom-5 left-5 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] text-white/40 hover:text-white border border-white/15 hover:border-white/30 bg-white/5 hover:bg-white/10 backdrop-blur-sm transition-colors cursor-pointer"
          style={{ animation: 'fade-in-up 0.5s ease-out 2.5s both' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" />
            <path strokeLinecap="round" d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
          </svg>
          Help
        </button>

        {/* ── CSV record picker modal ── */}
        {csvPickerFile && (() => {
          const _s = samples.find(s => s.filename === csvPickerFile)
          return (
            <CsvRecordModal
              filename={csvPickerFile}
              label={(locale === 'ja' && _s?.label_ja ? _s.label_ja : _s?.label) ?? csvPickerFile}
              records={recordCache[csvPickerFile]}
              search={recordSearch}
              onSearchChange={setRecordSearch}
              onSelect={(idx) => loadSampleRecord(csvPickerFile, idx)}
              onClose={() => { setCsvPickerFile(null); setRecordSearch('') }}
              t={t}
            />
          )
        })()}

        {/* ── Help modal ── */}
        {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} t={t} />}
      </div>
    )
  }

  // ============================
  // Loading
  // ============================
  if (loading && documents.length === 0) {
    return (
      <div className="min-h-screen bg-emo-bg emo-bg text-emo-text flex flex-col items-center justify-center">
        <div className="text-center relative z-10">
          <div className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-violet-500 border-r-transparent" style={{ animation: 'spin 1s linear infinite, pulse-glow 2s ease-in-out infinite' }} />
          <p className="mt-4 text-sm text-white/45 font-medium">{t('app.analysing')}</p>
        </div>
      </div>
    )
  }

  // ============================
  // Dashboard
  // ============================
  return (
    <div className="h-screen bg-emo-bg text-emo-text flex flex-col overflow-hidden">
      {/* ─── Ambient atmosphere orbs ─── */}
      <div className="dash-atmosphere">
        <div className="dash-orb-1" />
        <div className="dash-orb-2" />
        <div className="dash-orb-3" />
      </div>
      {/* ─── Top bar ─── */}
      <header className="dash-header bg-white/5 border-b border-white/10 text-emo-text px-5 py-2 flex items-center justify-between shrink-0 relative z-30 overflow-visible" style={{ animation: 'slide-down 0.4s ease-out both' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold tracking-tight bg-gradient-to-r from-violet-400 via-pink-400 to-violet-400 dash-title-breathe" style={{ WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>TextScope</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={resetAll}
            className="btn-glow flex items-center gap-1 text-[11px] text-white/40 hover:text-white border border-white/15 px-3 py-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M20.49 9A9 9 0 0 0 5.64 5.64L4 4m16 16l-1.64-1.64A9 9 0 0 1 3.51 15" />
            </svg>
            {t('app.newFile')}
          </button>
          <button
            onClick={toggleTheme}
            className="btn-glow text-white/40 hover:text-white border border-white/15 p-1.5 rounded-md hover:bg-white/10 transition-colors cursor-pointer"
            title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
          >
            {theme === 'dark' ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="12" cy="12" r="5" />
                <path strokeLinecap="round" d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => setLocale(locale === 'en' ? 'ja' : 'en')}
            className="btn-glow text-[11px] text-white/40 hover:text-white border border-white/15 px-2.5 py-1 rounded-md hover:bg-white/10 transition-colors cursor-pointer font-semibold"
          >
            {locale === 'en' ? 'JA' : 'EN'}
          </button>
        </div>
      </header>

      {/* ─── Document bar ─── */}
      <div className="bg-white/[0.03] border-b border-white/10 px-4 py-1.5 flex items-center gap-2 shrink-0 relative z-20">
        {/* Scrollable document tabs */}
        <div className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto">
          {documents.map((doc) => (
            <div
              key={doc.id}
              onClick={() => switchDocument(doc.id)}
              className={`group flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] cursor-pointer transition-all shrink-0 ${
                doc.id === activeDocId
                  ? 'bg-violet-500/15 text-violet-300 border border-violet-400/30 doc-tab-active'
                  : 'text-white/40 hover:text-white/60 border border-transparent hover:border-white/15 hover:bg-white/5'
              }`}
            >
              <span className="font-medium truncate max-w-32">{doc.filename}</span>
              <span className="text-[10px] opacity-60">({formatSize(doc.charCount)})</span>
              <button
                onClick={(e) => { e.stopPropagation(); removeDocument(doc.id) }}
                className="ml-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:text-rose-400 transition-opacity cursor-pointer"
                title={t('docbar.remove')}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>

        {/* Add document dropdown — outside scroll container so dropdown is not clipped */}
        <div className="relative shrink-0" ref={addMenuRef}>
          <button
            onClick={() => setAddMenuOpen(v => !v)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] text-white/30 hover:text-white/50 border border-dashed border-white/15 hover:border-white/25 hover:bg-white/5 transition-colors cursor-pointer"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" d="M12 5v14M5 12h14" />
            </svg>
            {t('docbar.add')}
          </button>
          {addMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--dropdown-bg)] border border-white/15 rounded-lg shadow-xl z-50 py-1 dropdown-glow">
              <button
                onClick={() => { setAddMenuOpen(false); addFileInputRef.current?.click() }}
                className="w-full text-left px-3 py-2 text-[12px] text-white/60 hover:text-white hover:bg-white/8 transition-colors cursor-pointer"
              >
                {t('docbar.upload')}
              </button>
              {samples.length > 0 && (
                <div className="border-t border-white/10 mt-1 pt-1">
                  {samples.map((s) => (
                    <button
                      key={s.filename}
                      onClick={() => (s.type === 'csv' || s.type === 'collection') ? openCsvPicker(s.filename) : loadSample(s.filename)}
                      className="w-full text-left px-3 py-1.5 hover:bg-white/8 transition-colors cursor-pointer flex items-center justify-between"
                    >
                      <div>
                        <div className="text-[11px] text-white/60">{locale === 'ja' && s.label_ja ? s.label_ja : s.label}</div>
                        <div className="text-[10px] text-white/25">{locale === 'ja' && s.description_ja ? s.description_ja : s.description}</div>
                      </div>
                      {(s.type === 'csv' || s.type === 'collection') && (
                        <svg className="w-3 h-3 text-white/30 shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hidden file input for add-document */}
        <input
          ref={addFileInputRef}
          type="file"
          accept=".txt,.md,.xml,.pdf,.csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }}
          className="hidden"
        />

        {loading && (
          <div className="ml-2 shrink-0">
            <div className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-violet-500 border-r-transparent" />
          </div>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {/* ─── Body: sidebar + main ─── */}
      <div ref={bodyRef} className="flex-1 min-h-0 flex" style={{ animation: 'fade-in-scale 0.5s ease-out 0.3s both' }}>
        {/* ─── Left sidebar ─── */}
        <aside
          className={`dash-sidebar shrink-0 flex flex-col border-r border-white/10 ${sidebarOpen ? '' : 'w-0 min-w-0 overflow-hidden'}`}
          style={sidebarOpen ? { width: sidebarWidth, transition: isDragging.current ? 'none' : 'width 0.2s' } : undefined}
        >
          {/* Sidebar sub-tabs */}
          <div className="relative flex items-center border-b border-white/10 shrink-0">
            {SIDEBAR_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setSidebarTab(tab.key)}
                onMouseEnter={() => setHoveredTab(tab.key)}
                onMouseLeave={() => setHoveredTab(null)}
                className={`tab-btn flex-1 px-3 py-2 text-[11px] font-semibold transition-colors cursor-pointer relative whitespace-nowrap ${
                  sidebarTab === tab.key ? 'text-violet-400 tab-btn--active' : 'text-white/30 hover:text-white/50'
                }`}
              >
                {tab.label}
                {sidebarTab === tab.key && <span className="tab-glow-indicator" />}
              </button>
            ))}
            {hoveredTab && SIDEBAR_TABS.some(st => st.key === hoveredTab) && (
              <div className="absolute left-2 top-full mt-0.5 z-50 max-w-xs px-3 py-2 rounded-lg text-[11px] leading-relaxed bg-[var(--dropdown-bg)] border border-white/15 shadow-xl dropdown-glow text-white/70 pointer-events-none"
                   style={{ animation: 'fade-in-up 0.15s ease-out both' }}>
                {t(`help.${hoveredTab}Desc` as any)}
              </div>
            )}
          </div>
          {/* Sidebar content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {sidebarTab === 'frequencies' && (
              <FrequencyTable
                frequencies={frequencies}
                language={language}
                selectedWord={selectedWord}
                onSelectWord={handleSelectWord}
                onDownloadCsv={downloadCsv}
                trackedWords={trackedWords}
                onToggleTrack={handleToggleTrack}
                scoreMode={scoreMode}
                onToggleScoreMode={() => setScoreMode((m) => m === 'count' ? 'tfidf' : 'count')}
                tfidfData={tfidfData}
              />
            )}
            {sidebarTab === 'coding' && (
              <CodingPanel
                rules={codingRules}
                onRulesChange={setCodingRules}
                conceptResults={conceptResults}
                onRunCoding={runCoding}
                running={codingRunning}
                trackedConcepts={trackedConcepts}
                onToggleTrackConcept={handleToggleTrackConcept}
              />
            )}
          </div>
        </aside>

        {/* ─── Resizable divider + sidebar toggle ─── */}
        <div
          className="shrink-0 w-2 flex items-center justify-center relative group cursor-col-resize select-none"
          onMouseDown={sidebarOpen ? onDividerMouseDown : undefined}
          onDoubleClick={() => setSidebarOpen((v) => !v)}
        >
          {/* Visible drag handle line */}
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-px bg-white/10 group-hover:bg-violet-400/40 transition-colors" />
          {/* Toggle chevron */}
          <button
            onClick={(e) => { e.stopPropagation(); setSidebarOpen((v) => !v) }}
            className="absolute z-10 w-5 h-8 flex items-center justify-center rounded-full bg-[var(--dropdown-bg)] border border-white/15 text-white/30 hover:text-white/60 transition-colors cursor-pointer shadow-md"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            <svg className={`w-3 h-3 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* ─── Right main area ─── */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Tab bar */}
          <div className="relative shrink-0">
            <nav className="bg-white/[0.03] border-b border-white/10 px-3 flex items-center gap-0 overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  onMouseEnter={() => setHoveredTab(tab.key)}
                  onMouseLeave={() => setHoveredTab(null)}
                  className={`tab-btn px-3 py-2 text-[11px] font-semibold transition-colors cursor-pointer relative whitespace-nowrap ${
                    activeTab === tab.key ? 'text-violet-400 tab-btn--active' : 'text-white/30 hover:text-white/50'
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.key && <span className="tab-glow-indicator" />}
                </button>
              ))}
            </nav>
            {hoveredTab && TABS.some(mt => mt.key === hoveredTab) && (
              <div className="absolute left-2 top-full mt-0.5 z-50 max-w-xs px-3 py-2 rounded-lg text-[11px] leading-relaxed bg-[var(--dropdown-bg)] border border-white/15 shadow-xl dropdown-glow text-white/70 pointer-events-none"
                   style={{ animation: 'fade-in-up 0.15s ease-out both' }}>
                {t(`help.${hoveredTab}Desc` as any)}
              </div>
            )}
          </div>

          {/* Main content */}
          <main className="flex-1 min-h-0 p-2.5">
            <div className="h-full glass-card overflow-hidden">
              {activeTab === 'kwic' && (
                <KwicPanel keyword={selectedWord} lines={kwicLines} loading={kwicLoading} />
              )}
              {activeTab === 'reader' && (
                <ReaderPanel
                  text={text} filename={filename} charCount={charCount}
                  highlightWord={selectedWord} language={language}
                />
              )}
              {activeTab === 'cloud' && (
                <WordCloudPanel frequencies={displayFrequencies} selectedWord={selectedWord} onSelectWord={handleSelectWord} />
              )}
              {activeTab === 'trends' && (
                <TrendsPanel
                  text={text} trackedWords={trackedWords} onToggleTrack={handleToggleTrack}
                  selectedWord={selectedWord} onSelectWord={handleSelectWord}
                  conceptSeries={conceptSeries}
                  onRemoveConcept={(n) => setTrackedConcepts((p) => p.filter((x) => x !== n))}
                />
              )}
              {activeTab === 'cooccurrence' && (
                <CooccurrencePanel text={text} selectedWord={selectedWord} onSelectWord={handleSelectWord} />
              )}
              {activeTab === 'correspondence' && (
                <CorrespondencePanel text={text} selectedWord={selectedWord} onSelectWord={handleSelectWord} />
              )}
              {activeTab === 'cluster' && (
                <ClusterPanel text={text} selectedWord={selectedWord} onSelectWord={handleSelectWord} />
              )}
              {activeTab === 'topics' && (
                <TopicPanel text={text} selectedWord={selectedWord} onSelectWord={handleSelectWord} />
              )}
              {activeTab === 'word2vec' && (
                <Word2VecPanel text={text} selectedWord={selectedWord} onSelectWord={handleSelectWord} />
              )}
              {activeTab === 'compare' && (
                <ComparePanel documents={documents} selectedWord={selectedWord} onSelectWord={handleSelectWord} />
              )}
            </div>
          </main>
        </div>
      </div>

      {/* ── CSV record picker modal (dashboard) ── */}
      {csvPickerFile && (() => {
        const _s = samples.find(s => s.filename === csvPickerFile)
        return (
          <CsvRecordModal
            filename={csvPickerFile}
            label={(locale === 'ja' && _s?.label_ja ? _s.label_ja : _s?.label) ?? csvPickerFile}
            records={recordCache[csvPickerFile]}
            search={recordSearch}
            onSearchChange={setRecordSearch}
            onSelect={(idx) => loadSampleRecord(csvPickerFile, idx)}
            onClose={() => { setCsvPickerFile(null); setRecordSearch('') }}
            t={t}
          />
        )
      })()}

      {/* ── Help button (bottom-left) ── */}
      <button
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-5 left-5 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] text-white/40 hover:text-white border border-white/15 hover:border-white/30 bg-white/5 hover:bg-white/10 backdrop-blur-sm transition-colors cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
        </svg>
        Help
      </button>

      {/* ── Help modal ── */}
      {helpOpen && <HelpModal onClose={() => setHelpOpen(false)} t={t} />}
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mx-2.5 mt-1 bg-rose-500/15 border border-rose-400/25 text-rose-300 rounded-lg px-4 py-2 text-xs font-medium">
      {message}
    </div>
  )
}

function CsvRecordModal({
  filename,
  label,
  records,
  search,
  onSearchChange,
  onSelect,
  onClose,
  t,
}: {
  filename: string
  label: string
  records: SampleRecord[] | undefined
  search: string
  onSearchChange: (v: string) => void
  onSelect: (index: number) => void
  onClose: () => void
  t: (key: string) => string
}) {
  const filtered = records
    ? records.filter((r) => {
        if (!search) return true
        const q = search.toLowerCase()
        return r.title.toLowerCase().includes(q) || r.speaker.toLowerCase().includes(q) || r.date.includes(q)
      })
    : []

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--overlay-bg)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] bg-[var(--dropdown-bg)] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden modal-glow"
        style={{ animation: 'fade-in-scale 0.25s ease-out both' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <h2 className="text-base font-bold bg-gradient-to-r from-violet-400 to-pink-400" style={{ WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>
            {label}
          </h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors cursor-pointer p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search bar */}
        <div className="px-6 py-3.5 border-b border-white/10 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t('sample.search')}
            className="w-full text-sm px-4 py-2.5 rounded-lg bg-white/8 border border-white/10 text-white/80 placeholder:text-white/30 outline-none focus:border-violet-400/50"
            autoFocus
          />
          {records && (
            <div className="mt-2 text-[11px] text-white/30">
              {filtered.length} {t('sample.records')}
            </div>
          )}
        </div>

        {/* Records list */}
        <div className="flex-1 overflow-y-auto">
          {!records && (
            <div className="flex items-center justify-center py-16">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-violet-500 border-r-transparent" />
            </div>
          )}
          {filtered.map((r) => (
            <button
              key={r.index}
              onClick={() => onSelect(r.index)}
              className="w-full text-left px-6 py-3.5 hover:bg-white/8 transition-colors cursor-pointer border-b border-white/5 flex items-center justify-between gap-6"
            >
              <div className="min-w-0">
                <div className="text-sm text-white/70 truncate">{r.title}</div>
                <div className="text-[11px] text-white/35 mt-1">{r.speaker}</div>
              </div>
              <div className="text-[11px] text-white/25 shrink-0">{r.date}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const HELP_SECTIONS: { key: string; icon: string }[] = [
  { key: 'gettingStarted', icon: 'M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z' },
  { key: 'frequencies', icon: 'M3 12h4l3-9 4 18 3-9h4' },
  { key: 'kwic', icon: 'M4 6h16M4 12h16M4 18h7' },
  { key: 'reader', icon: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' },
  { key: 'cloud', icon: 'M3 15a4 4 0 0 0 4 4h9a5 5 0 1 0-.1-10A7 7 0 0 0 3 15z' },
  { key: 'trends', icon: 'M3 17l6-6 4 4 8-8' },
  { key: 'cooccurrence', icon: 'M5.5 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18.5 8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 21.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM7.5 7l3.5 9M16.5 7l-3.5 9' },
  { key: 'correspondence', icon: 'M3 3v18h18M7 16l4-8 4 4 5-8' },
  { key: 'cluster', icon: 'M12 2v6m0 8v6M2 12h6m8 0h6M6 6l4 4m4 4l4 4M18 6l-4 4m-4 4l-4 4' },
  { key: 'topics', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z' },
  { key: 'word2vec', icon: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5' },
  { key: 'coding', icon: 'M16 18l6-6-6-6M8 6l-6 6 6 6' },
  { key: 'compare', icon: 'M9 5H2v14h7M15 5h7v14h-7M12 3v18' },
]

function HelpModal({ onClose, t }: { onClose: () => void; t: (key: string) => string }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'var(--overlay-bg)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] bg-[var(--dropdown-bg)] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden modal-glow"
        style={{ animation: 'fade-in-scale 0.25s ease-out both' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <h2 className="text-lg font-bold bg-gradient-to-r from-violet-400 to-pink-400" style={{ WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent', color: 'transparent' }}>
            {t('help.title')}
          </h2>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors cursor-pointer p-1"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {HELP_SECTIONS.map((sec) => (
            <div key={sec.key} className="flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center mt-0.5">
                <svg className="w-4 h-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d={sec.icon} />
                </svg>
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-white/80">{t(`help.${sec.key}` as any)}</h3>
                <p className="text-xs text-white/45 mt-0.5 leading-relaxed">{t(`help.${sec.key}Desc` as any)}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 shrink-0 text-right">
          <button
            onClick={onClose}
            className="text-[11px] text-white/50 hover:text-white border border-white/15 px-4 py-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            {t('help.close')}
          </button>
        </div>
      </div>
    </div>
  )
}
