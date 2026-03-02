import { useState, useRef, useEffect } from 'react'
import type { ImageFormat } from '../exportImage'

interface Props {
  panelName: string
  formats: ImageFormat[]
  onSave: (filename: string, format: ImageFormat) => void
  t: (key: any) => string
}

export default function SaveImagePopover({ panelName, formats, onSave, t }: Props) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [format, setFormat] = useState<ImageFormat>(formats[0])
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleOpen = () => {
    setOpen(!open)
    setName(`${panelName}.${format}`)
    setFormat(formats[0])
  }

  const handleSave = () => {
    const ext = `.${format}`
    const fname = name.trim() || `${panelName}${ext}`
    onSave(fname.endsWith(ext) ? fname : fname.replace(/\.\w+$/, '') + ext, format)
    setOpen(false)
  }

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={handleOpen}
        className="btn-glow flex items-center gap-1 text-[11px] border border-white/15 text-white/40 hover:text-white/70 px-2.5 py-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
        title={t('export.save')}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M12 10v6m0 0l-3-3m3 3l3-3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
        IMG
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--dropdown-bg)] border border-white/15 rounded-lg shadow-xl z-50 p-3 dropdown-glow">
          <label className="text-[10px] text-white/40 mb-1.5 block">{t('export.filename')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            className="w-full text-xs px-2.5 py-1.5 rounded-md bg-white/8 border border-white/10 text-white/80 placeholder:text-white/30 outline-none focus:border-violet-400/50"
            autoFocus
          />
          <label className="text-[10px] text-white/40 mt-2 mb-1.5 block">{t('export.format')}</label>
          <div className="flex gap-1.5">
            {formats.map((f) => (
              <button
                key={f}
                onClick={() => {
                  setFormat(f)
                  setName((prev) => prev.replace(/\.\w+$/, '') + `.${f}`)
                }}
                className={`flex-1 text-[11px] px-2 py-1 rounded-md border cursor-pointer transition-colors ${
                  format === f
                    ? 'bg-violet-500/30 border-violet-400/50 text-violet-300 font-medium'
                    : 'border-white/10 text-white/40 hover:bg-white/5'
                }`}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
          <button
            onClick={handleSave}
            className="mt-2.5 w-full text-xs text-white/70 bg-violet-500/20 hover:bg-violet-500/30 border border-violet-400/30 px-3 py-1.5 rounded-md transition-colors cursor-pointer font-medium"
          >
            {t('export.save')}
          </button>
        </div>
      )}
    </div>
  )
}
