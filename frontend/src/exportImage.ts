export type ImageFormat = 'png' | 'jpg' | 'svg'

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Canvas-based panels (WordCloud, Cluster) */
export function exportCanvas(canvas: HTMLCanvasElement, filename: string, format: ImageFormat) {
  if (format === 'jpg') {
    // Draw white background behind current content for JPG
    const w = canvas.width
    const h = canvas.height
    const tmp = document.createElement('canvas')
    tmp.width = w
    tmp.height = h
    const ctx = tmp.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(canvas, 0, 0)
    triggerDownload(tmp.toDataURL('image/jpeg', 0.92), filename)
  } else {
    triggerDownload(canvas.toDataURL('image/png'), filename)
  }
}

/**
 * Resolve all CSS variables and computed styles in a cloned SVG.
 * The cloned SVG will be serialised to a standalone Blob, so every
 * presentation attribute must carry its resolved value — it will have
 * no access to the page's stylesheets or CSS custom-properties.
 */
function resolveStyles(original: SVGSVGElement, clone: SVGSVGElement) {
  const rootStyle = getComputedStyle(document.documentElement)

  // Fast CSS-var resolver for attribute/style strings
  const resolveVars = (s: string) =>
    s.replace(/var\(--[^)]+\)/g, (m) => {
      const name = m.slice(4, -1).trim()
      return rootStyle.getPropertyValue(name).trim() || m
    })

  // SVG presentation attributes whose computed values should be
  // copied from the live DOM so the standalone SVG looks identical.
  const PRESENTATION_ATTRS = [
    'fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-opacity',
    'fill-opacity', 'opacity', 'color', 'stop-color', 'font-size',
    'font-family', 'font-weight', 'text-anchor', 'dominant-baseline',
  ] as const

  const origEls = original.querySelectorAll('*')
  const cloneEls = clone.querySelectorAll('*')

  for (let i = 0; i < origEls.length && i < cloneEls.length; i++) {
    const orig = origEls[i] as SVGElement
    const cl = cloneEls[i] as SVGElement

    // 1. Resolve var() inside the style attribute
    const styleAttr = cl.getAttribute('style')
    if (styleAttr && styleAttr.includes('var(')) {
      cl.setAttribute('style', resolveVars(styleAttr))
    }

    // 2. Resolve var() inside presentation attributes
    for (const attr of PRESENTATION_ATTRS) {
      const val = cl.getAttribute(attr)
      if (val && val.includes('var(')) {
        cl.setAttribute(attr, resolveVars(val))
      }
    }

    // 3. Copy key computed values from live DOM to ensure
    //    colours/fonts are baked in even when set via CSS classes
    const cs = getComputedStyle(orig)
    for (const attr of ['fill', 'stroke', 'color', 'stop-color'] as const) {
      const computed = cs.getPropertyValue(attr)
      if (!computed) continue
      const current = cl.getAttribute(attr)
      // Override if the attribute is absent, contains var(), or is 'none'
      // while the computed value is an actual colour.
      if (!current || current.includes('var(') || (current === 'none' && computed !== 'none')) {
        // Skip if computed is just inheriting a default we don't want to force
        if (computed !== 'rgb(0, 0, 0)' || current) {
          cl.setAttribute(attr, computed)
        }
      }
    }
  }
}

/** Get the app background colour so exported images have a matching backdrop. */
function getThemeBg(): string {
  const bg = getComputedStyle(document.documentElement).backgroundColor
  // Fallback: if transparent or not set, derive from the CSS variable
  if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--color-emo-bg').trim()
    return v || '#0f0a1a'
  }
  return bg
}

/** Insert a background <rect> as the first child of a standalone SVG. */
function addSvgBackground(svg: SVGSVGElement, color: string) {
  const ns = 'http://www.w3.org/2000/svg'
  const rect = document.createElementNS(ns, 'rect')
  rect.setAttribute('width', '100%')
  rect.setAttribute('height', '100%')
  rect.setAttribute('fill', color)
  svg.insertBefore(rect, svg.firstChild)
}

/** Recharts (SVG) panels (Trends, Correspondence, Topic, Word2Vec) */
export function exportSvg(container: HTMLElement, filename: string, format: ImageFormat) {
  // Prefer the main Recharts chart SVG; fall back to any SVG
  const svgEl = container.querySelector<SVGSVGElement>('svg.recharts-surface')
    ?? container.querySelector<SVGSVGElement>('svg')
  if (!svgEl) return

  const clone = svgEl.cloneNode(true) as SVGSVGElement
  resolveStyles(svgEl, clone)

  // Ensure explicit width/height and viewBox
  const rect = svgEl.getBoundingClientRect()
  clone.setAttribute('width', String(rect.width))
  clone.setAttribute('height', String(rect.height))
  if (!clone.getAttribute('viewBox')) {
    clone.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
  }
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

  // Add theme background so semi-transparent colours are visible
  const bg = getThemeBg()
  addSvgBackground(clone, bg)

  const xml = new XMLSerializer().serializeToString(clone)
  const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })

  if (format === 'svg') {
    triggerDownload(URL.createObjectURL(svgBlob), filename)
    return
  }

  // Rasterize to PNG/JPG
  const dpr = window.devicePixelRatio || 1
  const w = rect.width * dpr
  const h = rect.height * dpr

  const img = new Image()
  img.onload = () => {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    // Always fill with theme background (JPG needs opaque; PNG benefits too)
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
    triggerDownload(canvas.toDataURL(mime, 0.92), filename)
    URL.revokeObjectURL(img.src)
  }
  img.src = URL.createObjectURL(svgBlob)
}

/** Multiple SVGs stacked vertically (TopicPanel) */
export function exportMultipleSvgs(
  svgElements: SVGSVGElement[],
  labels: string[],
  filename: string,
  format: ImageFormat,
) {
  if (svgElements.length === 0) return

  const GAP = 12
  const LABEL_H = 20
  const dpr = window.devicePixelRatio || 1

  // Measure each SVG
  const entries = svgElements.map((svg, i) => {
    const rect = svg.getBoundingClientRect()
    const clone = svg.cloneNode(true) as SVGSVGElement
    resolveStyles(svg, clone)
    clone.setAttribute('width', String(rect.width))
    clone.setAttribute('height', String(rect.height))
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    addSvgBackground(clone, getThemeBg())
    return { clone, w: rect.width, h: rect.height, label: labels[i] || '' }
  })

  const maxW = Math.max(...entries.map((e) => e.w))
  const totalH = entries.reduce((sum, e) => sum + (e.label ? LABEL_H : 0) + e.h + GAP, 0) - GAP

  const bg = getThemeBg()

  if (format === 'svg') {
    // Build a combined SVG
    const ns = 'http://www.w3.org/2000/svg'
    const root = document.createElementNS(ns, 'svg')
    root.setAttribute('xmlns', ns)
    root.setAttribute('width', String(maxW))
    root.setAttribute('height', String(totalH))
    addSvgBackground(root, bg)
    let y = 0
    for (const { clone, h, label } of entries) {
      if (label) {
        const text = document.createElementNS(ns, 'text')
        text.setAttribute('x', '4')
        text.setAttribute('y', String(y + 14))
        text.setAttribute('font-size', '12')
        text.setAttribute('fill', '#aaa')
        text.textContent = label
        root.appendChild(text)
        y += LABEL_H
      }
      const g = document.createElementNS(ns, 'g')
      g.setAttribute('transform', `translate(0,${y})`)
      // Move children from clone into g
      while (clone.firstChild) g.appendChild(clone.firstChild)
      root.appendChild(g)
      y += h + GAP
    }
    const xml = new XMLSerializer().serializeToString(root)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    triggerDownload(URL.createObjectURL(blob), filename)
    return
  }

  // Rasterize: draw each SVG onto a single canvas
  const canvasW = maxW * dpr
  const canvasH = totalH * dpr
  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, maxW, totalH)

  let drawn = 0
  let yOffset = 0
  const yOffsets: number[] = []
  const labelHeights: number[] = []
  for (const { label, h } of entries) {
    labelHeights.push(label ? LABEL_H : 0)
    yOffsets.push(yOffset + (label ? LABEL_H : 0))
    yOffset += (label ? LABEL_H : 0) + h + GAP
  }

  // Draw labels first
  ctx.font = '12px sans-serif'
  ctx.fillStyle = '#aaaaaa'
  let ly = 0
  for (const { label, h } of entries) {
    if (label) {
      ctx.fillText(label, 4, ly + 14)
      ly += LABEL_H
    }
    ly += h + GAP
  }

  for (let i = 0; i < entries.length; i++) {
    const { clone, w, h } = entries[i]
    const xml = new XMLSerializer().serializeToString(clone)
    const blob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' })
    const img = new Image()
    const yo = yOffsets[i]
    img.onload = () => {
      ctx.drawImage(img, 0, yo, w, h)
      URL.revokeObjectURL(img.src)
      drawn++
      if (drawn === entries.length) {
        const mime = format === 'jpg' ? 'image/jpeg' : 'image/png'
        triggerDownload(canvas.toDataURL(mime, 0.92), filename)
      }
    }
    img.src = URL.createObjectURL(blob)
  }
}

/** Cytoscape panel (Co-occurrence) */
export function exportCytoscape(cy: any, filename: string, format: ImageFormat) {
  const opts = { full: true, scale: 2, bg: format === 'jpg' ? '#ffffff' : undefined }
  const dataUrl = format === 'jpg' ? cy.jpg(opts) : cy.png(opts)
  triggerDownload(dataUrl, filename)
}
