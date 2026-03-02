import { useEffect, useRef } from 'react'

const TITLE_LETTERS = 'TextScope'.split('')

const PARTICLES = Array.from({ length: 8 }, (_, i) => ({
  left: `${12 + i * 11}%`,
  size: 2 + (i % 3),
  duration: 3 + (i % 4) * 0.8,
  delay: 1 + i * 0.4,
  color: ['#a855f7', '#ec4899', '#2dd4bf'][i % 3],
}))

const DOTS = Array.from({ length: 24 }, (_, i) => ({
  delay: 0.5 + i * 0.03,
}))

interface IntroSplashProps {
  onComplete: () => void
  t: (key: any) => string
}

export default function IntroSplash({ onComplete, t }: IntroSplashProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const duration = reducedMotion ? 800 : 5500
    timerRef.current = setTimeout(onComplete, duration)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [onComplete])

  const handleSkip = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    onComplete()
  }

  return (
    <div className="intro-overlay">
      {/* Phase 1: Spark */}
      <div className="intro-spark" />
      <div className="intro-scanline intro-scanline--left" />
      <div className="intro-scanline intro-scanline--right" />

      {/* Dot grid 4×6 */}
      <div className="intro-dot-grid">
        {DOTS.map((dot, i) => (
          <div
            key={i}
            className="intro-dot"
            style={{ animationDelay: `${dot.delay}s` }}
          />
        ))}
      </div>

      {/* Phase 2: Brand title */}
      <div className="intro-title intro-title--converge">
        <div className="intro-shimmer" />
        {TITLE_LETTERS.map((ch, i) => (
          <span
            key={i}
            className="intro-letter"
            style={{ animationDelay: `${1 + i * 0.06}s` }}
          >
            {ch}
          </span>
        ))}
      </div>

      {/* Taglines */}
      <div className="intro-tagline intro-tagline--1">{t('intro.tagline1')}</div>
      <div className="intro-tagline intro-tagline--2">{t('intro.tagline2')}</div>

      {/* Phase 3: Feature Triptych */}
      <div className="intro-features">
        <div className="intro-feature intro-feature--1">
          <div className="intro-feature__icon intro-icon-bars">
            <span /><span /><span /><span />
          </div>
          <span className="intro-feature__label">{t('intro.feature1')}</span>
        </div>

        <div className="intro-feature intro-feature--2">
          <div className="intro-feature__icon intro-icon-network">
            <span /><span /><span />
          </div>
          <span className="intro-feature__label">{t('intro.feature2')}</span>
        </div>

        <div className="intro-feature intro-feature--3">
          <div className="intro-feature__icon intro-icon-search" />
          <span className="intro-feature__label">{t('intro.feature3')}</span>
        </div>
      </div>

      {/* Phase 4: Convergence orbs */}
      <div className="intro-orb intro-orb--violet" />
      <div className="intro-orb intro-orb--pink" />
      <div className="intro-orb intro-orb--teal" />

      {/* Floating particles */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          className="intro-particle"
          style={{
            left: p.left,
            width: `${p.size}px`,
            height: `${p.size}px`,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      {/* Skip button */}
      <button className="intro-skip" onClick={handleSkip}>
        {t('intro.skip')}
      </button>
    </div>
  )
}
