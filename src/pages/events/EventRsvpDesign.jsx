import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Eye,
  ImagePlus,
  Monitor,
  RotateCcw,
  Save,
  Smartphone,
  UploadCloud,
} from 'lucide-react'

import EventShellHeader from '@/components/events/EventShellHeader'
import RsvpThemeRenderer from '@/components/events/rsvp/RsvpThemeRenderer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEvent } from '@/contexts/EventContext'
import {
  getEventRsvpPage,
  publishEventRsvpPage,
  restorePublishedEventRsvpDraft,
  upsertEventRsvpDraft,
  uploadRsvpAsset,
} from '@/lib/eventService'
import {
  buildDefaultRsvpPageConfig,
  buildRsvpPreviewGuest,
  getRsvpThemeMeta,
  RSVP_BODY_FONT_OPTIONS,
  RSVP_HEADING_FONT_OPTIONS,
  RSVP_THEME_CATALOG,
} from '@/lib/rsvpPageConfig'
import { cn } from '@/lib/utils'

const EDITOR_TABS = [
  { key: 'template', label: 'Plantilla' },
  { key: 'branding', label: 'Branding' },
  { key: 'content', label: 'Contenido' },
]

const RSVP_PREVIEW_FORM = {
  responseStatus: 'confirmed',
  plusOnes: 1,
  comment: 'Felicidades por este gran dia.',
  dietaryRestrictions: 'Sin gluten',
}

function TextArea({ value, onChange, rows = 4, placeholder = '' }) {
  return (
    <textarea
      value={value}
      onChange={onChange}
      rows={rows}
      placeholder={placeholder}
      className="min-h-24 w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    />
  )
}

function Field({ label, description = '', children }) {
  return (
    <label className="space-y-2">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {children}
    </label>
  )
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-none border border-border px-4 py-3">
      <span className="text-sm text-foreground">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4"
      />
    </label>
  )
}

function AssetPanel({
  title,
  description,
  url,
  uploading,
  onUploadClick,
  onRemove,
}) {
  return (
    <div className="space-y-3 rounded-none border border-border p-4">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {url ? (
        <img src={url} alt={title} className="h-48 w-full rounded-none border border-border object-cover" />
      ) : (
        <div className="flex h-48 items-center justify-center rounded-none border border-dashed border-border bg-secondary/20 text-xs uppercase tracking-[0.24em] text-muted-foreground">
          Sin imagen
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="rounded-none" onClick={onUploadClick} disabled={uploading}>
          <UploadCloud className="mr-2 h-4 w-4" />
          {uploading ? 'Subiendo...' : 'Subir imagen'}
        </Button>
        {url && (
          <Button type="button" variant="outline" className="rounded-none" onClick={onRemove} disabled={uploading}>
            Quitar
          </Button>
        )}
      </div>
    </div>
  )
}

function syncIframeStyles(iframeDocument) {
  iframeDocument.head.innerHTML = ''

  const meta = iframeDocument.createElement('meta')
  meta.name = 'viewport'
  meta.content = 'width=device-width, initial-scale=1'
  iframeDocument.head.appendChild(meta)

  const base = iframeDocument.createElement('base')
  base.href = window.location.origin
  iframeDocument.head.appendChild(base)

  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    iframeDocument.head.appendChild(node.cloneNode(true))
  })
}

function RsvpPreviewViewport({
  event,
  guest,
  pageConfig,
  previewDevice,
}) {
  const iframeRef = useRef(null)
  const [mountNode, setMountNode] = useState(null)
  const isMobilePreview = previewDevice === 'mobile'

  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return undefined

    const iframeDocument = iframe.contentDocument
    if (!iframeDocument) return undefined

    iframeDocument.open()
    iframeDocument.write('<!doctype html><html><head></head><body><div id="rsvp-preview-root"></div></body></html>')
    iframeDocument.close()

    syncIframeStyles(iframeDocument)
    iframeDocument.documentElement.className = document.documentElement.className
    iframeDocument.body.className = 'bg-background text-foreground antialiased'
    iframeDocument.body.style.margin = '0'
    iframeDocument.body.style.minHeight = '100%'
    iframeDocument.body.style.overflow = 'auto'

    setMountNode(iframeDocument.getElementById('rsvp-preview-root'))

    return () => setMountNode(null)
  }, [previewDevice])

  return (
    <div
      className={cn(
        'mx-auto overflow-hidden bg-background shadow-sm',
        isMobilePreview
          ? 'w-full max-w-[390px] rounded-[2rem] border-[10px] border-slate-950 p-1'
          : 'w-[1180px] max-w-none rounded-none border border-border',
      )}
    >
      <iframe
        ref={iframeRef}
        title={isMobilePreview ? 'Vista previa movil RSVP' : 'Vista previa escritorio RSVP'}
        className={cn(
          'block w-full border-0 bg-background',
          isMobilePreview ? 'h-[760px] rounded-[1.35rem]' : 'h-[820px] rounded-none',
        )}
      />
      {mountNode && createPortal(
        <RsvpThemeRenderer
          event={event}
          guest={guest}
          pageConfig={pageConfig}
          form={RSVP_PREVIEW_FORM}
          onFormChange={() => {}}
          onSubmit={() => {}}
          preview
        />,
        mountNode,
      )}
    </div>
  )
}

function RsvpLivePreviewFrame({
  event,
  guest,
  pageConfig,
  previewDevice,
  onPreviewDeviceChange,
  className = '',
  bodyClassName = '',
}) {
  return (
    <Card className={cn('rounded-none border-border bg-card shadow-sm', className)}>
      <CardHeader className="gap-4 border-b border-border">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">
              Vista previa en vivo
            </CardTitle>
            <CardDescription className="mt-2">
              Muestra el borrador actual. La pagina publica cambia solo al publicar.
            </CardDescription>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              type="button"
              variant={previewDevice === 'mobile' ? 'default' : 'outline'}
              className="rounded-none"
              onClick={() => onPreviewDeviceChange('mobile')}
            >
              <Smartphone className="mr-2 h-4 w-4" />
              Movil
            </Button>
            <Button
              type="button"
              variant={previewDevice === 'desktop' ? 'default' : 'outline'}
              className="rounded-none"
              onClick={() => onPreviewDeviceChange('desktop')}
            >
              <Monitor className="mr-2 h-4 w-4" />
              Escritorio
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={cn('bg-secondary/20 p-4', bodyClassName)}>
        <RsvpPreviewViewport
          event={event}
          guest={guest}
          pageConfig={pageConfig}
          previewDevice={previewDevice}
        />
      </CardContent>
    </Card>
  )
}

export default function EventRsvpDesign() {
  const { events, event, eventId } = useEvent()
  const [activeTab, setActiveTab] = useState('template')
  const [pageData, setPageData] = useState(null)
  const [draftConfig, setDraftConfig] = useState(buildDefaultRsvpPageConfig())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [uploadingKind, setUploadingKind] = useState('')
  const [previewDevice, setPreviewDevice] = useState('desktop')
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [errorMessage, setErrorMessage] = useState('')

  const heroInputRef = useRef(null)
  const logoInputRef = useRef(null)
  const galleryInputRef = useRef(null)

  useEffect(() => {
    if (!notice) return undefined
    const timer = setTimeout(() => setNotice(''), 5000)
    return () => clearTimeout(timer)
  }, [notice])

  const loadPage = useCallback(async () => {
    if (!eventId) return

    setLoading(true)
    setErrorMessage('')

    try {
      const nextPageData = await getEventRsvpPage(eventId, event)
      setPageData(nextPageData)
      setDraftConfig(nextPageData.draft_config)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible cargar el diseno RSVP.')
    } finally {
      setLoading(false)
    }
  }, [eventId, event])

  useEffect(() => {
    loadPage()
  }, [loadPage])

  const themeMeta = useMemo(() => getRsvpThemeMeta(draftConfig.layout.template_key), [draftConfig.layout.template_key])
  const previewGuest = useMemo(() => buildRsvpPreviewGuest(), [])
  const isDirty = useMemo(() => {
    if (!pageData) return false
    return JSON.stringify(draftConfig) !== JSON.stringify(pageData.draft_config)
  }, [draftConfig, pageData])

  function patchSection(sectionKey, patch) {
    setDraftConfig((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        ...patch,
      },
    }))
  }

  function patchFaq(index, patch) {
    const nextFaq = [...draftConfig.content.faq_items]
    nextFaq[index] = {
      ...nextFaq[index],
      ...patch,
    }

    patchSection('content', { faq_items: nextFaq })
  }

  function addFaqItem() {
    if (draftConfig.content.faq_items.length >= 6) return

    patchSection('content', {
      faq_items: [...draftConfig.content.faq_items, { question: '', answer: '' }],
    })
  }

  function removeFaqItem(index) {
    patchSection('content', {
      faq_items: draftConfig.content.faq_items.filter((_, itemIndex) => itemIndex !== index),
    })
  }

  async function handleSaveDraft() {
    if (!eventId) return

    setSaving(true)
    setErrorMessage('')

    try {
      const nextPageData = await upsertEventRsvpDraft(eventId, draftConfig, event)
      setPageData(nextPageData)
      setDraftConfig(nextPageData.draft_config)
      setNotice('Borrador guardado.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible guardar el borrador.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    if (!eventId) return

    setPublishing(true)
    setErrorMessage('')

    try {
      await upsertEventRsvpDraft(eventId, draftConfig, event)
      const nextPageData = await publishEventRsvpPage(eventId, event)
      setPageData(nextPageData)
      setDraftConfig(nextPageData.draft_config)
      setNotice('Cambios publicados en la pagina RSVP.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible publicar el diseno RSVP.')
    } finally {
      setPublishing(false)
    }
  }

  async function handleRestorePublished() {
    if (!eventId) return

    setRestoring(true)
    setErrorMessage('')

    try {
      const nextPageData = await restorePublishedEventRsvpDraft(eventId, event)
      setPageData(nextPageData)
      setDraftConfig(nextPageData.draft_config)
      setNotice(nextPageData.has_published ? 'Borrador restaurado desde la version publicada.' : 'Se restauro la plantilla base del RSVP.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible restaurar el borrador.')
    } finally {
      setRestoring(false)
    }
  }

  async function handleAssetUpload(kind, fileList) {
    const files = Array.from(fileList || [])
    if (!files.length || !eventId) return

    setUploadingKind(kind)
    setErrorMessage('')

    try {
      if (kind === 'gallery') {
        const availableSlots = Math.max(0, 6 - draftConfig.branding.gallery_urls.length)
        const uploads = await Promise.all(files.slice(0, availableSlots).map((file) => uploadRsvpAsset(eventId, file, kind)))
        patchSection('branding', {
          gallery_urls: [...draftConfig.branding.gallery_urls, ...uploads.map((upload) => upload.url)].slice(0, 6),
        })
      } else {
        const upload = await uploadRsvpAsset(eventId, files[0], kind)
        patchSection('branding', {
          [`${kind}_image_url`]: upload.url,
        })
      }

      setNotice('Asset cargado en el borrador. Guarda o publica para dejarlo activo.')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'No fue posible subir el asset.')
    } finally {
      setUploadingKind('')
      if (heroInputRef.current) heroInputRef.current.value = ''
      if (logoInputRef.current) logoInputRef.current.value = ''
      if (galleryInputRef.current) galleryInputRef.current.value = ''
    }
  }

  const headerActions = (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" className="rounded-none" onClick={handleRestorePublished} disabled={loading || restoring}>
        <RotateCcw className="mr-2 h-4 w-4" />
        {restoring ? 'Restaurando...' : 'Restaurar publicado'}
      </Button>
      <Button variant="outline" className="rounded-none" onClick={handleSaveDraft} disabled={loading || saving}>
        <Save className="mr-2 h-4 w-4" />
        {saving ? 'Guardando...' : 'Guardar borrador'}
      </Button>
      <Button className="rounded-none" onClick={handlePublish} disabled={loading || publishing}>
        {publishing ? 'Publicando...' : 'Publicar cambios'}
      </Button>
    </div>
  )

  return (
    <div className="space-y-6 py-6">
      <EventShellHeader
        events={events}
        currentEvent={event}
        activeTab="diseno-rsvp"
        actions={headerActions}
      />

      {notice && (
        <div className="rounded-none border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300">
          {notice}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-none border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
          {errorMessage}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        <Card className="rounded-none border-border bg-card shadow-sm">
          <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Diseno RSVP</CardTitle>
              <CardDescription className="mt-2">
                Personaliza la portada, colores, fotos y contenido del enlace publico. El invitado solo vera la version publicada.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isDirty && (
                <Badge className="rounded-full px-3 py-1 uppercase tracking-[0.2em]">
                  Cambios sin guardar
                </Badge>
              )}
              <Badge variant="outline" className="rounded-full px-3 py-1 uppercase tracking-[0.2em]">
                Tema {themeMeta.label}
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 uppercase tracking-[0.2em]">
                {pageData?.has_published ? 'Publicado' : 'Solo borrador'}
              </Badge>
              <Button
                type="button"
                variant="outline"
                className="rounded-none xl:hidden"
                onClick={() => {
                  setPreviewDevice('mobile')
                  setMobilePreviewOpen(true)
                }}
              >
                <Eye className="mr-2 h-4 w-4" />
                Ver vista previa
              </Button>
            </div>
          </CardHeader>

          <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="gap-6">
            <TabsList variant="line" className="w-full justify-start rounded-none border-b border-border p-0">
              {EDITOR_TABS.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="rounded-none px-4 py-3 uppercase tracking-[0.2em]">
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="template" className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                {RSVP_THEME_CATALOG.map((theme) => (
                  <button
                    key={theme.key}
                    type="button"
                    onClick={() => patchSection('layout', { template_key: theme.key })}
                    className={cn(
                      'rounded-none border p-5 text-left transition-colors',
                      draftConfig.layout.template_key === theme.key
                        ? 'border-foreground bg-secondary/40'
                        : 'border-border bg-background hover:bg-secondary/20',
                    )}
                  >
                    <p className="font-heading text-2xl tracking-wide text-foreground">{theme.label}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{theme.description}</p>
                  </button>
                ))}
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Card className="rounded-none border-border bg-background shadow-none">
                  <CardHeader>
                    <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Layout</CardTitle>
                    <CardDescription>Ajusta la composicion principal del hero.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field label="Alineacion del hero">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Button type="button" variant={draftConfig.layout.hero_alignment === 'center' ? 'default' : 'outline'} className="rounded-none" onClick={() => patchSection('layout', { hero_alignment: 'center' })}>Centrado</Button>
                        <Button type="button" variant={draftConfig.layout.hero_alignment === 'left' ? 'default' : 'outline'} className="rounded-none" onClick={() => patchSection('layout', { hero_alignment: 'left' })}>Alineado a la izquierda</Button>
                      </div>
                    </Field>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-border bg-background shadow-none">
                  <CardHeader>
                    <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Estado del editor</CardTitle>
                    <CardDescription>Trabajas siempre sobre borrador. El publico solo ve lo publicado.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <p>Evento: <span className="text-foreground">{event?.name || 'Sin nombre'}</span></p>
                    <p>Publicado: <span className="text-foreground">{pageData?.published_at ? new Date(pageData.published_at).toLocaleString() : 'Aun no'}</span></p>
                    <p>Tema activo: <span className="text-foreground">{themeMeta.label}</span></p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="branding" className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-3">
                <AssetPanel
                  title="Hero"
                  description="Imagen principal de portada. Recomendado: horizontal y con buena resolucion."
                  url={draftConfig.branding.hero_image_url}
                  uploading={uploadingKind === 'hero'}
                  onUploadClick={() => heroInputRef.current?.click()}
                  onRemove={() => patchSection('branding', { hero_image_url: '' })}
                />
                <AssetPanel
                  title="Logo"
                  description="Monograma o logotipo opcional para el encabezado."
                  url={draftConfig.branding.logo_image_url}
                  uploading={uploadingKind === 'logo'}
                  onUploadClick={() => logoInputRef.current?.click()}
                  onRemove={() => patchSection('branding', { logo_image_url: '' })}
                />
                <div className="space-y-3 rounded-none border border-border p-4">
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Galeria</p>
                    <p className="text-xs text-muted-foreground">Hasta 6 imagenes para complementar la portada.</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {draftConfig.branding.gallery_urls.map((url, index) => (
                      <div key={url} className="space-y-2">
                        <img src={url} alt={`Galeria ${index + 1}`} className="h-32 w-full rounded-none border border-border object-cover" />
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full rounded-none"
                          onClick={() => patchSection('branding', {
                            gallery_urls: draftConfig.branding.gallery_urls.filter((item) => item !== url),
                          })}
                        >
                          Quitar
                        </Button>
                      </div>
                    ))}
                    {!draftConfig.branding.gallery_urls.length && (
                      <div className="flex h-32 items-center justify-center rounded-none border border-dashed border-border bg-secondary/20 text-xs uppercase tracking-[0.24em] text-muted-foreground sm:col-span-2">
                        Sin galeria
                      </div>
                    )}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-none"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={uploadingKind === 'gallery' || draftConfig.branding.gallery_urls.length >= 6}
                  >
                    <ImagePlus className="mr-2 h-4 w-4" />
                    {uploadingKind === 'gallery' ? 'Subiendo...' : 'Agregar imagenes'}
                  </Button>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-3">
                <Field label="Color principal">
                  <div className="flex gap-3">
                    <Input type="color" value={draftConfig.branding.primary_color} onChange={(event) => patchSection('branding', { primary_color: event.target.value })} className="h-11 w-16 rounded-none p-1" />
                    <Input value={draftConfig.branding.primary_color} onChange={(event) => patchSection('branding', { primary_color: event.target.value })} className="rounded-none" />
                  </div>
                </Field>
                <Field label="Color secundario">
                  <div className="flex gap-3">
                    <Input type="color" value={draftConfig.branding.secondary_color} onChange={(event) => patchSection('branding', { secondary_color: event.target.value })} className="h-11 w-16 rounded-none p-1" />
                    <Input value={draftConfig.branding.secondary_color} onChange={(event) => patchSection('branding', { secondary_color: event.target.value })} className="rounded-none" />
                  </div>
                </Field>
                <Field label="Color de acento">
                  <div className="flex gap-3">
                    <Input type="color" value={draftConfig.branding.accent_color} onChange={(event) => patchSection('branding', { accent_color: event.target.value })} className="h-11 w-16 rounded-none p-1" />
                    <Input value={draftConfig.branding.accent_color} onChange={(event) => patchSection('branding', { accent_color: event.target.value })} className="rounded-none" />
                  </div>
                </Field>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <Field label="Tipografia de titulos">
                  <select
                    value={draftConfig.branding.heading_font}
                    onChange={(event) => patchSection('branding', { heading_font: event.target.value })}
                    className="h-10 rounded-none border border-border bg-background px-3 text-sm"
                  >
                    {RSVP_HEADING_FONT_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Tipografia de texto">
                  <select
                    value={draftConfig.branding.body_font}
                    onChange={(event) => patchSection('branding', { body_font: event.target.value })}
                    className="h-10 rounded-none border border-border bg-background px-3 text-sm"
                  >
                    {RSVP_BODY_FONT_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>{option.label}</option>
                    ))}
                  </select>
                </Field>
              </div>

              <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
                <ToggleRow label="Mostrar logo" checked={draftConfig.visibility.show_logo} onChange={(value) => patchSection('visibility', { show_logo: value })} />
                <ToggleRow label="Mostrar galeria" checked={draftConfig.visibility.show_gallery} onChange={(value) => patchSection('visibility', { show_gallery: value })} />
                <ToggleRow label="Mostrar dress code" checked={draftConfig.visibility.show_dress_code} onChange={(value) => patchSection('visibility', { show_dress_code: value })} />
                <ToggleRow label="Mostrar mesa de regalos" checked={draftConfig.visibility.show_gift} onChange={(value) => patchSection('visibility', { show_gift: value })} />
                <ToggleRow label="Mostrar mapa" checked={draftConfig.visibility.show_map} onChange={(value) => patchSection('visibility', { show_map: value })} />
                <ToggleRow label="Mostrar FAQ" checked={draftConfig.visibility.show_faq} onChange={(value) => patchSection('visibility', { show_faq: value })} />
              </div>
            </TabsContent>

            <TabsContent value="content" className="space-y-6">
              <div className="grid gap-6 xl:grid-cols-2">
                <Card className="rounded-none border-border bg-background shadow-none">
                  <CardHeader>
                    <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Hero y bienvenida</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field label="Badge de bienvenida"><Input value={draftConfig.content.welcome_badge} onChange={(event) => patchSection('content', { welcome_badge: event.target.value })} className="rounded-none" /></Field>
                    <Field label="Titulo principal"><Input value={draftConfig.content.welcome_title} onChange={(event) => patchSection('content', { welcome_title: event.target.value })} className="rounded-none" /></Field>
                    <Field label="Mensaje de bienvenida"><TextArea value={draftConfig.content.welcome_message} onChange={(event) => patchSection('content', { welcome_message: event.target.value })} /></Field>
                    <Field label="Nombres que se muestran"><Input value={draftConfig.content.couple_names} onChange={(event) => patchSection('content', { couple_names: event.target.value })} className="rounded-none" /></Field>
                    <Field label="Resumen del evento" description="Fecha y sede visibles en el hero."><Input value={draftConfig.content.event_summary} onChange={(event) => patchSection('content', { event_summary: event.target.value })} className="rounded-none" /></Field>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-border bg-background shadow-none">
                  <CardHeader>
                    <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Informacion extra</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field label="Titulo dress code"><Input value={draftConfig.content.dress_code_title} onChange={(event) => patchSection('content', { dress_code_title: event.target.value })} className="rounded-none" /></Field>
                    <Field label="Texto dress code"><TextArea value={draftConfig.content.dress_code_text} onChange={(event) => patchSection('content', { dress_code_text: event.target.value })} /></Field>
                    <Field label="Titulo mesa de regalos"><Input value={draftConfig.content.gift_title} onChange={(event) => patchSection('content', { gift_title: event.target.value })} className="rounded-none" /></Field>
                    <Field label="Texto mesa de regalos"><TextArea value={draftConfig.content.gift_text} onChange={(event) => patchSection('content', { gift_text: event.target.value })} /></Field>
                    <Field label="URL mesa de regalos"><Input value={draftConfig.content.gift_url} onChange={(event) => patchSection('content', { gift_url: event.target.value })} className="rounded-none" /></Field>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 xl:grid-cols-2">
                <Card className="rounded-none border-border bg-background shadow-none">
                  <CardHeader>
                    <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Mapa y FAQ</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field label="Titulo mapa"><Input value={draftConfig.content.map_title} onChange={(event) => patchSection('content', { map_title: event.target.value })} className="rounded-none" /></Field>
                    <Field label="URL de Google Maps" description="Pega una URL normal de Google Maps o una URL de embed. Evita links cortos; abre el link y pega la URL completa."><Input value={draftConfig.content.map_embed_url} onChange={(event) => patchSection('content', { map_embed_url: event.target.value })} className="rounded-none" /></Field>
                    <Field label="Titulo FAQ"><Input value={draftConfig.content.faq_title} onChange={(event) => patchSection('content', { faq_title: event.target.value })} className="rounded-none" /></Field>
                    <div className="space-y-3 rounded-none border border-border p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">Preguntas frecuentes</p>
                        <Button type="button" variant="outline" className="rounded-none" onClick={addFaqItem} disabled={draftConfig.content.faq_items.length >= 6}>
                          Agregar
                        </Button>
                      </div>
                      <div className="space-y-4">
                        {draftConfig.content.faq_items.map((item, index) => (
                          <div key={`faq-${index}`} className="space-y-3 rounded-none border border-border p-3">
                            <Field label={`Pregunta ${index + 1}`}><Input value={item.question} onChange={(event) => patchFaq(index, { question: event.target.value })} className="rounded-none" /></Field>
                            <Field label="Respuesta"><TextArea value={item.answer} onChange={(event) => patchFaq(index, { answer: event.target.value })} rows={3} /></Field>
                            <Button type="button" variant="outline" className="rounded-none" onClick={() => removeFaqItem(index)}>Quitar pregunta</Button>
                          </div>
                        ))}
                        {!draftConfig.content.faq_items.length && (
                          <p className="text-sm text-muted-foreground">Todavia no agregas preguntas frecuentes.</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="rounded-none border-border bg-background shadow-none">
                  <CardHeader>
                    <CardTitle className="font-heading text-2xl tracking-wide text-card-foreground">Mensaje final</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Field label="Titulo de confirmacion"><Input value={draftConfig.content.confirmation_success_title} onChange={(event) => patchSection('content', { confirmation_success_title: event.target.value })} className="rounded-none" /></Field>
                    <Field label="Mensaje de confirmacion"><TextArea value={draftConfig.content.confirmation_success_message} onChange={(event) => patchSection('content', { confirmation_success_message: event.target.value })} /></Field>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>

        <aside className="hidden xl:block">
          <div className="sticky top-6">
            <RsvpLivePreviewFrame
              event={event}
              guest={previewGuest}
              pageConfig={draftConfig}
              previewDevice={previewDevice}
              onPreviewDeviceChange={setPreviewDevice}
              bodyClassName="max-h-[calc(100vh-12rem)] overflow-auto"
            />
          </div>
        </aside>
      </div>

      <Dialog open={mobilePreviewOpen} onOpenChange={setMobilePreviewOpen}>
        <DialogContent className="h-[92vh] max-w-5xl gap-0 overflow-hidden rounded-none p-0" showCloseButton>
          <DialogHeader className="border-b border-border px-4 py-3 text-left">
            <DialogTitle className="font-heading text-2xl tracking-wide">Vista previa RSVP</DialogTitle>
            <DialogDescription>
              Preview del borrador actual. No modifica la version publicada.
            </DialogDescription>
          </DialogHeader>
          <div className="h-[calc(92vh-5.75rem)] overflow-auto p-4">
            <RsvpLivePreviewFrame
              event={event}
              guest={previewGuest}
              pageConfig={draftConfig}
              previewDevice={previewDevice}
              onPreviewDeviceChange={setPreviewDevice}
              bodyClassName="max-h-none overflow-visible"
            />
          </div>
        </DialogContent>
      </Dialog>

      <input
        ref={heroInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => handleAssetUpload('hero', event.target.files)}
      />
      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(event) => handleAssetUpload('logo', event.target.files)}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="hidden"
        onChange={(event) => handleAssetUpload('gallery', event.target.files)}
      />
    </div>
  )
}
