import { useState, useCallback } from 'react'
import { useLocale } from '../i18n'

export interface CodingRule {
  name: string
  expression: string
}

export interface ConceptResult {
  concept: string
  total_matches: number
  total_sentences: number
  segment_counts: number[]
  matched_sentences: { text: string }[]
}

interface Props {
  rules: CodingRule[]
  onRulesChange: (rules: CodingRule[]) => void
  conceptResults: ConceptResult[]
  onRunCoding: () => void
  running: boolean
  trackedConcepts: string[]
  onToggleTrackConcept: (name: string) => void
}

export default function CodingPanel({
  rules, onRulesChange, conceptResults, onRunCoding, running,
  trackedConcepts, onToggleTrackConcept,
}: Props) {
  const { t } = useLocale()
  const [draftName, setDraftName] = useState('')
  const [draftExpr, setDraftExpr] = useState('')

  const addRule = useCallback(() => {
    const name = draftName.trim()
    const expr = draftExpr.trim()
    if (!name || !expr) return
    if (rules.some((r) => r.name === name)) return
    onRulesChange([...rules, { name, expression: expr }])
    setDraftName('')
    setDraftExpr('')
  }, [draftName, draftExpr, rules, onRulesChange])

  const removeRule = useCallback((name: string) => {
    onRulesChange(rules.filter((r) => r.name !== name))
  }, [rules, onRulesChange])

  return (
    <div className="flex flex-col h-full">
      {/* Form */}
      <div className="px-4 py-3 border-b border-white/8 space-y-2 shrink-0">
        <input
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder={t('coding.conceptName')}
          className="w-full text-sm border border-white/15 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 bg-white/8 text-white placeholder:text-white/25"
        />
        <input
          value={draftExpr}
          onChange={(e) => setDraftExpr(e.target.value)}
          placeholder={'"AI" AND ("culture" OR "society")'}
          onKeyDown={(e) => e.key === 'Enter' && addRule()}
          className="w-full text-sm border border-white/15 rounded-lg px-3 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 bg-white/8 text-white placeholder:text-white/25"
        />
        <div className="flex gap-2">
          <button
            onClick={addRule}
            disabled={!draftName.trim() || !draftExpr.trim()}
            className="text-xs text-[#fff] px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer font-medium"
          >
            {t('coding.addRule')}
          </button>
          <button
            onClick={onRunCoding}
            disabled={rules.length === 0 || running}
            className="text-xs text-[#fff] px-3 py-1.5 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-400 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer font-medium"
          >
            {running ? t('coding.running') : t('coding.runAll')}
          </button>
        </div>
      </div>

      {/* Rule list + results */}
      <div className="flex-1 overflow-y-auto">
        {rules.length === 0 ? (
          <div className="p-6 text-center text-white/25 text-sm">
            <p className="font-medium mb-1">{t('coding.noRules')}</p>
            <p className="text-xs leading-relaxed">
              {t('coding.instructions')}<br />
              <code className="bg-white/10 px-1 rounded text-white/35">AND</code>{' '}
              <code className="bg-white/10 px-1 rounded text-white/35">OR</code>{' '}
              <code className="bg-white/10 px-1 rounded text-white/35">NOT</code>{' '}
              <code className="bg-white/10 px-1 rounded text-white/35">"quoted terms"</code>{' '}
              <code className="bg-white/10 px-1 rounded text-white/35">(groups)</code>
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/8">
            {rules.map((rule) => {
              const result = conceptResults.find((r) => r.concept === rule.name)
              const tracked = trackedConcepts.includes(rule.name)
              return (
                <div key={rule.name} className="px-4 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-semibold text-white/80 truncate">{rule.name}</span>
                      {result && (
                        <span className="text-xs bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded-full tabular-nums shrink-0">
                          {result.total_matches}/{result.total_sentences}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => onToggleTrackConcept(rule.name)}
                        title={tracked ? t('coding.removeFromTrends') : t('coding.addToTrends')}
                        className={`p-1 rounded transition-colors cursor-pointer ${
                          tracked ? 'text-violet-400 hover:text-violet-300' : 'text-white/15 hover:text-white/40'
                        }`}
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 17l6-6 4 4 8-8" />
                        </svg>
                      </button>
                      <button
                        onClick={() => removeRule(rule.name)}
                        className="p-1 text-white/15 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  <p className="text-xs font-mono text-white/25 mt-0.5 truncate">{rule.expression}</p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
