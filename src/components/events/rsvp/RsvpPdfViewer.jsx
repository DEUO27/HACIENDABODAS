import { useEffect, useRef, useState } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ExternalLink, FileText } from 'lucide-react'
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

import { Button } from '@/components/ui/button'

pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl

function ViewerFallback({ url, accentColor }) {
  return (
    <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-none border border-border bg-white p-8 text-center shadow-sm">
        <FileText className="mx-auto h-14 w-14 text-foreground" />
        <h2 className="mt-4 font-heading text-2xl tracking-wide text-foreground">Tu invitacion</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          No fue posible mostrar la invitacion aqui. Abrela en una pestana nueva y vuelve para confirmar tu asistencia.
        </p>
        <Button
          className="mt-6 h-12 w-full rounded-none"
          style={{ backgroundColor: accentColor, borderColor: accentColor, color: '#ffffff' }}
          onClick={() => {
            if (typeof window !== 'undefined' && url) {
              window.open(url, '_blank', 'noopener,noreferrer')
            }
          }}
        >
          <ExternalLink className="mr-2 h-4 w-4" />
          Abrir invitacion
        </Button>
      </div>
    </div>
  )
}

function RsvpPdfDocument({ url, accentColor, containerWidth }) {
  const [numPages, setNumPages] = useState(null)
  const [loadError, setLoadError] = useState(false)

  if (loadError) {
    return <ViewerFallback url={url} accentColor={accentColor} />
  }

  return (
    <Document
      file={url}
      onLoadSuccess={({ numPages: total }) => setNumPages(total)}
      onLoadError={() => setLoadError(true)}
      onSourceError={() => setLoadError(true)}
      loading={
        <div className="h-[calc(100vh-9rem)] w-full animate-pulse bg-secondary/40" />
      }
      error={<ViewerFallback url={url} accentColor={accentColor} />}
      noData={<ViewerFallback url={url} accentColor={accentColor} />}
    >
      {numPages
        ? Array.from({ length: numPages }, (_, index) => (
            <div key={index} className="mb-2 flex justify-center bg-white shadow-sm">
              <Page
                pageNumber={index + 1}
                width={containerWidth || undefined}
                renderTextLayer={false}
                renderAnnotationLayer={false}
              />
            </div>
          ))
        : null}
    </Document>
  )
}

export default function RsvpPdfViewer({ url, accentColor = '#a46c47' }) {
  const containerRef = useRef(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const node = containerRef.current
    if (!node || typeof ResizeObserver === 'undefined') return undefined

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const width = entry.contentRect.width
      if (!width) return
      setContainerWidth(Math.min(Math.floor(width), 1024))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={containerRef} className="w-full">
      <RsvpPdfDocument key={url} url={url} accentColor={accentColor} containerWidth={containerWidth} />
    </div>
  )
}
