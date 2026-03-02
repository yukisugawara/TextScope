import { useRef, useState } from 'react'
import { useLocale } from '../i18n'

const ACCEPTED = '.txt,.md,.xml,.pdf,.csv'

interface Props {
  onUpload: (file: File) => void
  disabled?: boolean
}

export default function UploadZone({ onUpload, disabled }: Props) {
  const { t } = useLocale()
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onUpload(file)
  }

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      onClick={() => inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-300
        ${disabled ? 'opacity-50 pointer-events-none' : ''}
        ${dragging
          ? 'border-violet-400 bg-violet-500/10 shadow-glow scale-[1.02]'
          : 'border-white/20 hover:border-violet-400/50 bg-white/5'}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f) }}
        className="hidden"
      />
      <svg className="mx-auto h-10 w-10 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M12 16v-8m0 0l-3 3m3-3l3 3M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
      <p className="text-white/70 font-medium mt-2 text-sm">
        {dragging ? t('upload.drop') : t('upload.dragOrClick')}
      </p>
      <p className="text-xs text-white/25 mt-1">{t('upload.formats')}</p>
    </div>
  )
}
