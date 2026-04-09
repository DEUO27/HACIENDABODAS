import {
  CheckCircle2,
  Gift,
  HeartHandshake,
  HelpCircle,
  ImageIcon,
  MapPin,
  XCircle,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { formatEventDate } from '@/lib/eventModuleUtils'
import {
  buildDefaultRsvpPageConfig,
  getRsvpFontFamilies,
  mergeRsvpPageConfig,
  normalizeRsvpMapEmbedUrl,
} from '@/lib/rsvpPageConfig'

const THEME_PRESETS = {
  editorial: {
    pageClass: 'bg-[#f5efe8] text-[#2d1f19]',
    shellClass: 'bg-white/85 border-[#d9c7ba]',
    heroOverlayClass: 'bg-gradient-to-t from-black/55 via-black/15 to-transparent',
    sectionClass: 'bg-white/85 border-[#d9c7ba]',
  },
  romantic: {
    pageClass: 'bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.18),_transparent_35%),linear-gradient(180deg,_#fff7fb,_#fff1f2)] text-[#4a2333]',
    shellClass: 'bg-white/85 border-[#f2c4d6]',
    heroOverlayClass: 'bg-gradient-to-t from-[#742d4f]/60 via-[#742d4f]/20 to-transparent',
    sectionClass: 'bg-white/80 border-[#f4cfe0]',
  },
  minimal: {
    pageClass: 'bg-[#f8fafc] text-[#0f172a]',
    shellClass: 'bg-white border-[#dbe3eb]',
    heroOverlayClass: 'bg-gradient-to-t from-slate-950/55 via-slate-900/10 to-transparent',
    sectionClass: 'bg-white border-[#dbe3eb]',
  },
  garden: {
    pageClass: 'bg-[linear-gradient(180deg,_#f3faf1,_#eef6ef)] text-[#183226]',
    shellClass: 'bg-white/90 border-[#bdd5c5]',
    heroOverlayClass: 'bg-gradient-to-t from-[#173d29]/60 via-[#173d29]/20 to-transparent',
    sectionClass: 'bg-white/85 border-[#bdd5c5]',
  },
}

function normalizeEvent(event) {
  return {
    id: event?.id || null,
    name: event?.name || 'Tu evento',
    eventDate: event?.eventDate || event?.event_date || null,
    venue: event?.venue || '',
    timezone: event?.timezone || 'America/Mexico_City',
  }
}

function normalizeGuest(guest) {
  return {
    id: guest?.id || null,
    fullName: guest?.fullName || guest?.full_name || 'Invitado de ejemplo',
    plusOnesAllowed: guest?.plusOnesAllowed ?? guest?.plus_ones_allowed ?? 2,
    attendanceStatus: guest?.attendanceStatus || guest?.attendance_status || 'pending',
  }
}

function InfoSection({ title, icon, children, className }) {
  if (!children) return null

  const SectionIcon = icon

  return (
    <section className={cn('space-y-3 rounded-none border p-5', className)}>
      <div className="flex items-center gap-2">
        <SectionIcon className="h-4 w-4" />
        <h3 className="text-sm uppercase tracking-[0.24em]">{title}</h3>
      </div>
      <div className="space-y-3 text-sm leading-6">{children}</div>
    </section>
  )
}

function buildShellStyle(config) {
  const fonts = getRsvpFontFamilies(config)

  return {
    '--rsvp-primary': config.branding.primary_color,
    '--rsvp-secondary': config.branding.secondary_color,
    '--rsvp-accent': config.branding.accent_color,
    '--rsvp-heading-font': fonts.heading,
    '--rsvp-body-font': fonts.body,
  }
}

export default function RsvpThemeRenderer({
  event,
  guest,
  pageConfig,
  loading = false,
  errorState = null,
  submitted = null,
  form,
  onFormChange,
  onSubmit,
  submitting = false,
  preview = false,
}) {
  const normalizedEvent = normalizeEvent(event)
  const normalizedGuest = normalizeGuest(guest)
  const mergedConfig = mergeRsvpPageConfig(buildDefaultRsvpPageConfig(normalizedEvent), pageConfig || {}, normalizedEvent)
  const themeKey = mergedConfig.layout.template_key || 'editorial'
  const theme = THEME_PRESETS[themeKey] || THEME_PRESETS.editorial
  const shellStyle = buildShellStyle(mergedConfig)
  const accentButtonStyle = {
    backgroundColor: mergedConfig.branding.accent_color,
    borderColor: mergedConfig.branding.accent_color,
    color: '#ffffff',
  }
  const outlineButtonStyle = {
    borderColor: mergedConfig.branding.primary_color,
    color: mergedConfig.branding.primary_color,
  }

  const hasHeroImage = Boolean(mergedConfig.branding.hero_image_url)
  const heroTextAlign = mergedConfig.layout.hero_alignment === 'left' ? 'text-left items-start' : 'text-center items-center'
  const eventSummary = mergedConfig.content.event_summary || [formatEventDate(normalizedEvent.eventDate), normalizedEvent.venue].filter(Boolean).join(' · ')
  const mapEmbedUrl = normalizeRsvpMapEmbedUrl(mergedConfig.content.map_embed_url)

  return (
    <div
      className={cn('min-h-screen', theme.pageClass)}
      style={{
        ...shellStyle,
        fontFamily: 'var(--rsvp-body-font)',
      }}
    >
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {preview && (
          <div className="mb-4 rounded-none border border-dashed border-foreground/25 bg-white/65 px-4 py-3 text-xs uppercase tracking-[0.24em]">
            Vista previa del RSVP publicado
          </div>
        )}

        {loading && (
          <div className={cn('space-y-4 rounded-none border p-8 shadow-sm', theme.shellClass)}>
            <div className="h-12 animate-pulse rounded-none bg-secondary/40" />
            <div className="h-72 animate-pulse rounded-none bg-secondary/30" />
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="h-60 animate-pulse rounded-none bg-secondary/30" />
              <div className="h-60 animate-pulse rounded-none bg-secondary/30" />
            </div>
          </div>
        )}

        {!loading && errorState && !submitted && !preview && (
          <div className={cn('rounded-none border p-8 text-center shadow-sm', theme.shellClass)}>
            <XCircle className="mx-auto h-14 w-14 text-rose-500" />
            <h2 className="mt-4 text-3xl" style={{ fontFamily: 'var(--rsvp-heading-font)' }}>
              Este enlace no esta disponible
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              {errorState.message || 'El enlace ya expiro o fue reemplazado.'}
            </p>
          </div>
        )}

        {!loading && (!errorState || preview || submitted) && (
          <div className="space-y-6">
            <section
              className={cn(
                'relative overflow-hidden rounded-none border shadow-sm',
                theme.shellClass,
              )}
            >
              <div
                className="relative min-h-[380px] overflow-hidden"
                style={hasHeroImage
                  ? {
                      backgroundImage: `url(${mergedConfig.branding.hero_image_url})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : {
                      background: `linear-gradient(135deg, ${mergedConfig.branding.secondary_color}, ${mergedConfig.branding.primary_color}22)`,
                    }}
              >
                {!hasHeroImage && (
                  <div className="absolute inset-0 opacity-50">
                    <div className="absolute -left-16 top-12 h-48 w-48 rounded-full bg-[var(--rsvp-accent)]/15 blur-3xl" />
                    <div className="absolute bottom-10 right-8 h-56 w-56 rounded-full bg-[var(--rsvp-primary)]/10 blur-3xl" />
                  </div>
                )}
                <div className={cn('absolute inset-0', theme.heroOverlayClass)} />

                <div className={cn('relative z-10 flex min-h-[380px] flex-col justify-end gap-5 p-6 sm:p-10', heroTextAlign)}>
                  {mergedConfig.visibility.show_logo && mergedConfig.branding.logo_image_url && (
                    <img
                      src={mergedConfig.branding.logo_image_url}
                      alt="Logo RSVP"
                      className="h-16 w-auto object-contain sm:h-20"
                    />
                  )}

                  <div className={cn('max-w-3xl space-y-3', mergedConfig.layout.hero_alignment === 'left' ? 'items-start' : 'items-center')}>
                    <p className="text-xs uppercase tracking-[0.35em] text-white/85">
                      {mergedConfig.content.welcome_badge}
                    </p>
                    <h1
                      className={cn(
                        'text-4xl sm:text-6xl',
                        themeKey === 'minimal' ? 'tracking-tight' : 'tracking-[0.04em]',
                      )}
                      style={{ fontFamily: 'var(--rsvp-heading-font)', color: '#ffffff' }}
                    >
                      {mergedConfig.content.welcome_title}
                    </h1>
                    {mergedConfig.content.couple_names && (
                      <p className="text-lg uppercase tracking-[0.3em] text-white/90">
                        {mergedConfig.content.couple_names}
                      </p>
                    )}
                    <p className="max-w-2xl text-sm leading-7 text-white/85 sm:text-base">
                      {mergedConfig.content.welcome_message}
                    </p>
                    {eventSummary && (
                      <p className="text-sm uppercase tracking-[0.24em] text-white/80">
                        {eventSummary}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {mergedConfig.visibility.show_gallery && mergedConfig.branding.gallery_urls.length > 0 && (
              <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {mergedConfig.branding.gallery_urls.map((url) => (
                  <div key={url} className={cn('overflow-hidden rounded-none border shadow-sm', theme.sectionClass)}>
                    <img src={url} alt="Galeria RSVP" className="h-48 w-full object-cover" />
                  </div>
                ))}
              </section>
            )}

            <div className={cn(
              'grid gap-6',
              themeKey === 'minimal' ? 'lg:grid-cols-[0.95fr_1.05fr]' : 'lg:grid-cols-[1.1fr_0.9fr]',
            )}>
              <div className="space-y-4">
                <InfoSection title="Invitacion" icon={HeartHandshake} className={theme.sectionClass}>
                  <p>
                    <strong>{normalizedGuest.fullName}</strong>, esta confirmacion corresponde al evento de{' '}
                    <strong>{normalizedEvent.name}</strong>.
                  </p>
                  {normalizedEvent.venue && <p>{normalizedEvent.venue}</p>}
                  {normalizedEvent.eventDate && <p>{formatEventDate(normalizedEvent.eventDate)}</p>}
                </InfoSection>

                {mergedConfig.visibility.show_dress_code && mergedConfig.content.dress_code_text && (
                  <InfoSection title={mergedConfig.content.dress_code_title} icon={ImageIcon} className={theme.sectionClass}>
                    <p>{mergedConfig.content.dress_code_text}</p>
                  </InfoSection>
                )}

                {mergedConfig.visibility.show_gift && (mergedConfig.content.gift_text || mergedConfig.content.gift_url) && (
                  <InfoSection title={mergedConfig.content.gift_title} icon={Gift} className={theme.sectionClass}>
                    {mergedConfig.content.gift_text && <p>{mergedConfig.content.gift_text}</p>}
                    {mergedConfig.content.gift_url && (
                      <Button asChild className="rounded-none" style={accentButtonStyle}>
                        <a href={mergedConfig.content.gift_url} target="_blank" rel="noreferrer">Ver mesa de regalos</a>
                      </Button>
                    )}
                  </InfoSection>
                )}

                {mergedConfig.visibility.show_map && mergedConfig.content.map_embed_url && (
                  <InfoSection title={mergedConfig.content.map_title} icon={MapPin} className={theme.sectionClass}>
                    {mapEmbedUrl ? (
                      <div className="overflow-hidden rounded-none border">
                        <iframe
                          src={mapEmbedUrl}
                          title="Mapa del evento"
                          className="h-64 w-full"
                          loading="lazy"
                          allowFullScreen
                          referrerPolicy="no-referrer-when-downgrade"
                        />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          Esta URL de mapa no se puede incrustar. Abre el mapa en una nueva pestana o pega una URL completa de Google Maps con coordenadas.
                        </p>
                        <Button asChild variant="outline" className="rounded-none" style={outlineButtonStyle}>
                          <a href={mergedConfig.content.map_embed_url} target="_blank" rel="noreferrer">Abrir mapa</a>
                        </Button>
                      </div>
                    )}
                  </InfoSection>
                )}

                {mergedConfig.visibility.show_faq && mergedConfig.content.faq_items.length > 0 && (
                  <InfoSection title={mergedConfig.content.faq_title} icon={HelpCircle} className={theme.sectionClass}>
                    <div className="space-y-4">
                      {mergedConfig.content.faq_items.map((item, index) => (
                        <div key={`${item.question}-${index}`} className="space-y-1">
                          <p className="text-xs uppercase tracking-[0.24em] text-muted-foreground">{item.question}</p>
                          <p>{item.answer}</p>
                        </div>
                      ))}
                    </div>
                  </InfoSection>
                )}
              </div>

              <div className={cn('rounded-none border p-5 shadow-sm sm:p-6', theme.sectionClass)}>
                {!submitted ? (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <p className="text-xs uppercase tracking-[0.3em]" style={{ color: mergedConfig.branding.primary_color }}>
                        RSVP
                      </p>
                      <h2 className="text-3xl" style={{ fontFamily: 'var(--rsvp-heading-font)' }}>
                        {normalizedGuest.fullName}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        Responde tu asistencia en menos de un minuto.
                      </p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <Button
                        type="button"
                        className="h-12 rounded-none"
                        style={form?.responseStatus === 'confirmed' ? accentButtonStyle : outlineButtonStyle}
                        variant={form?.responseStatus === 'confirmed' ? 'default' : 'outline'}
                        onClick={() => onFormChange?.((current) => ({ ...current, responseStatus: 'confirmed' }))}
                        disabled={preview}
                      >
                        Confirmo asistencia
                      </Button>
                      <Button
                        type="button"
                        className="h-12 rounded-none"
                        style={form?.responseStatus === 'declined' ? accentButtonStyle : outlineButtonStyle}
                        variant={form?.responseStatus === 'declined' ? 'default' : 'outline'}
                        onClick={() => onFormChange?.((current) => ({ ...current, responseStatus: 'declined', plusOnes: 0 }))}
                        disabled={preview}
                      >
                        No podre asistir
                      </Button>
                    </div>

                    {form?.responseStatus === 'confirmed' && (
                      <label className="space-y-2">
                        <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                          Acompanantes (max. {normalizedGuest.plusOnesAllowed})
                        </span>
                        <Input
                          type="number"
                          min="0"
                          max={normalizedGuest.plusOnesAllowed}
                          value={form.plusOnes}
                          onChange={(event) => {
                            const parsed = parseInt(event.target.value, 10)
                            const clamped = Number.isNaN(parsed) ? 0 : Math.max(0, Math.min(parsed, normalizedGuest.plusOnesAllowed))
                            onFormChange?.((current) => ({ ...current, plusOnes: clamped }))
                          }}
                          className="rounded-none"
                          disabled={preview}
                        />
                      </label>
                    )}

                    <label className="space-y-2">
                      <span className="text-xs uppercase tracking-[0.24em] text-muted-foreground">
                        Comentario (opcional)
                      </span>
                      <textarea
                        value={form?.comment || ''}
                        onChange={(event) => onFormChange?.((current) => ({ ...current, comment: event.target.value }))}
                        className="min-h-24 w-full rounded-none border border-border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                        disabled={preview}
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
                        disabled={preview}
                      />
                    </label>

                    <Button
                      className="h-12 w-full rounded-none"
                      style={accentButtonStyle}
                      onClick={onSubmit}
                      disabled={submitting || preview}
                    >
                      {preview ? 'Vista previa' : submitting ? 'Enviando...' : 'Enviar respuesta'}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4 text-center">
                    <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" />
                    <div className="space-y-2">
                      <h2 className="text-3xl" style={{ fontFamily: 'var(--rsvp-heading-font)' }}>
                        {mergedConfig.content.confirmation_success_title}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {mergedConfig.content.confirmation_success_message}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
