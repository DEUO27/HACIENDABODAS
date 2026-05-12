import { useMemo, useState } from 'react'
import { CheckCircle2, ExternalLink, FileText, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'
import { isIos } from '@/lib/userAgent'
import { clampCompanionCounts, parseCompanionCount } from '@/lib/rsvpFormHelpers'

function PreviewBanner() {
  return (
    <div className="border-b border-dashed border-foreground/25 bg-white/65 px-4 py-3 text-center text-xs uppercase tracking-[0.24em]">
      Vista previa del borrador RSVP
    </div>
  )
}

function PdfModeSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-neutral-100">
      <div className="mx-auto w-full max-w-5xl flex-1 p-4">
        <div className="h-[calc(100vh-9rem)] w-full animate-pulse bg-secondary/40" />
      </div>
      <div className="border-t border-border bg-background px-4 py-3">
        <div className="mx-auto flex max-w-3xl gap-2">
          <div className="h-12 flex-1 animate-pulse bg-secondary/40" />
          <div className="h-12 flex-1 animate-pulse bg-secondary/40" />
        </div>
      </div>
    </div>
  )
}

function PdfModeMessage({ icon, title, message, children }) {
  const Icon = icon
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-md rounded-none border border-border bg-white p-8 text-center shadow-sm">
        <Icon className="mx-auto h-14 w-14 text-rose-500" />
        <h2 className="mt-4 font-heading text-2xl tracking-wide text-foreground">{title}</h2>
        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
        {children}
      </div>
    </div>
  )
}

function PdfModeError({ state }) {
  return (
    <PdfModeMessage
      icon={XCircle}
      title="Este enlace no esta disponible"
      message={state?.message || 'El enlace ya expiro o fue reemplazado.'}
    />
  )
}

function PdfModeMissing() {
  return (
    <PdfModeMessage
      icon={FileText}
      title="La invitacion no esta disponible"
      message="No pudimos cargar el archivo de la invitacion. Contacta a los anfitriones para que lo revisen."
    />
  )
}

function PdfModeSuccess({ pageConfig }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <div className="w-full max-w-md rounded-none border border-border bg-white p-8 text-center shadow-sm">
        <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
        <h2 className="mt-4 font-heading text-2xl tracking-wide text-foreground">
          {pageConfig.content.confirmation_success_title}
        </h2>
        <p className="mt-3 text-sm text-muted-foreground">
          {pageConfig.content.confirmation_success_message}
        </p>
      </div>
    </div>
  )
}

function PdfNativeFallback({ url, accentColor }) {
  return (
    <div className="flex min-h-[calc(100vh-9rem)] items-center justify-center p-6">
      <div className="w-full max-w-md rounded-none border border-border bg-white p-8 text-center shadow-sm">
        <FileText className="mx-auto h-14 w-14 text-foreground" />
        <h2 className="mt-4 font-heading text-2xl tracking-wide text-foreground">Tu invitacion</h2>
        <p className="mt-3 text-sm text-muted-foreground">
          Abre el PDF en una pestana nueva. Cuando termines, vuelve aqui para confirmar tu asistencia.
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

export default function RsvpPdfMode({
  guest,
  pageConfig,
  stage = null,
  loading = false,
  errorState = null,
  submitted = null,
  form,
  onFormChange,
  onSubmit,
  submitting = false,
  preview = false,
}) {
  const stageLabel = stage === 'confirmacion_2' ? 'Confirmacion Final' : stage === 'confirmacion_1' ? 'Confirmacion Inicial' : ''

  const [drawerOpen, setDrawerOpen] = useState(false)
  const [intent, setIntent] = useState(null)
  const useNativeFallback = useMemo(() => isIos(), [])

  const pdfUrl = pageConfig?.branding?.invitation_pdf_url || ''
  const accentColor = pageConfig?.branding?.accent_color || '#a46c47'
  const primaryColor = pageConfig?.branding?.primary_color || '#7c5847'
  const confirmLabel = pageConfig?.content?.pdf_confirm_label || 'Confirmar asistencia'
  const declineLabel = pageConfig?.content?.pdf_decline_label || 'No podre asistir'

  const adultPlusOnes = parseCompanionCount(form?.adultPlusOnes ?? form?.plusOnes)
  const childPlusOnes = parseCompanionCount(form?.childPlusOnes)
  const totalPlusOnes = adultPlusOnes + childPlusOnes
  const maxPlusOnes = parseCompanionCount(guest?.plusOnesAllowed ?? guest?.plus_ones_allowed ?? 0)
  const companionLimitExceeded = totalPlusOnes > maxPlusOnes

  function updateCompanionCounts(nextAdult, nextChild) {
    const clamped = clampCompanionCounts(nextAdult, nextChild, maxPlusOnes)
    onFormChange?.((current) => ({ ...current, ...clamped }))
  }

  function openDrawerWithIntent(nextIntent) {
    if (preview) return
    setIntent(nextIntent)
    onFormChange?.((current) => ({
      ...current,
      responseStatus: nextIntent,
      ...(nextIntent === 'declined'
        ? { adultPlusOnes: 0, childPlusOnes: 0, plusOnes: 0 }
        : {}),
    }))
    setDrawerOpen(true)
  }

  if (loading) return <PdfModeSkeleton />
  if (errorState && !preview && !submitted) return <PdfModeError state={errorState} />
  if (submitted) return <PdfModeSuccess pageConfig={pageConfig} />
  if (!pdfUrl && !preview) return <PdfModeMissing />

  const accentButtonStyle = {
    backgroundColor: accentColor,
    borderColor: accentColor,
    color: '#ffffff',
  }
  const outlineButtonStyle = {
    borderColor: primaryColor,
    color: primaryColor,
  }

  return (
    <div className="min-h-screen bg-neutral-100 pb-32">
      {preview && <PreviewBanner />}

      <div className="mx-auto max-w-5xl">
        {pdfUrl ? (
          useNativeFallback ? (
            <PdfNativeFallback url={pdfUrl} accentColor={accentColor} />
          ) : (
            <iframe
              src={`${pdfUrl}#view=FitH&toolbar=0`}
              title="Invitacion"
              className="h-[calc(100vh-9rem)] w-full border-0 bg-white"
            />
          )
        ) : (
          <div className="flex h-[calc(100vh-9rem)] items-center justify-center p-6">
            <div className="rounded-none border border-dashed border-foreground/25 bg-white/65 px-6 py-8 text-center text-sm uppercase tracking-[0.24em] text-muted-foreground">
              Sube un PDF para ver la vista previa
            </div>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={preview}
            onClick={() => openDrawerWithIntent('declined')}
            className="h-12 flex-1 rounded-none"
            style={outlineButtonStyle}
          >
            {declineLabel}
          </Button>
          <Button
            type="button"
            disabled={preview}
            onClick={() => openDrawerWithIntent('confirmed')}
            className="h-12 flex-1 rounded-none"
            style={accentButtonStyle}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>

      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader className="space-y-2 text-left">
            <SheetTitle className="font-heading text-2xl tracking-wide">
              {intent === 'confirmed' ? 'Confirma tu asistencia' : 'No podras asistir'}
            </SheetTitle>
            <SheetDescription>
              {guest?.fullName || 'Invitado'}{stageLabel ? ` · ${stageLabel}` : ''}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-5 px-4 pb-6">
            {intent === 'confirmed' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                    Acompanantes
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {totalPlusOnes} de {maxPlusOnes}
                  </span>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Adultos
                    </span>
                    <Input
                      type="number"
                      min="0"
                      max={Math.max(0, maxPlusOnes - childPlusOnes)}
                      value={adultPlusOnes}
                      onChange={(event) => updateCompanionCounts(event.target.value, childPlusOnes)}
                      className="rounded-none"
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Ninos
                    </span>
                    <Input
                      type="number"
                      min="0"
                      max={Math.max(0, maxPlusOnes - adultPlusOnes)}
                      value={childPlusOnes}
                      onChange={(event) => updateCompanionCounts(adultPlusOnes, event.target.value)}
                      className="rounded-none"
                    />
                  </label>
                </div>
                {companionLimitExceeded && (
                  <p className="text-xs text-rose-600">
                    El total de acompanantes no puede superar {maxPlusOnes}.
                  </p>
                )}
              </div>
            )}

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Comentario (opcional)
              </span>
              <textarea
                value={form?.comment || ''}
                onChange={(event) => onFormChange?.((current) => ({ ...current, comment: event.target.value }))}
                className="min-h-24 w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </label>

            <label className="space-y-2">
              <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                Restricciones alimentarias
              </span>
              <textarea
                value={form?.dietaryRestrictions || ''}
                onChange={(event) => onFormChange?.((current) => ({ ...current, dietaryRestrictions: event.target.value }))}
                className="min-h-24 w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              />
            </label>

            {errorState && submitted === null && (
              <p className="text-sm text-rose-600">
                {errorState.message || 'No fue posible registrar tu respuesta. Intenta de nuevo.'}
              </p>
            )}

            <div className={cn('flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end')}>
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-none sm:w-32"
                onClick={() => setDrawerOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="h-12 rounded-none sm:flex-1"
                style={accentButtonStyle}
                onClick={onSubmit}
                disabled={submitting || companionLimitExceeded}
              >
                {submitting ? 'Enviando...' : intent === 'confirmed' ? 'Confirmar respuesta' : 'Enviar respuesta'}
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
