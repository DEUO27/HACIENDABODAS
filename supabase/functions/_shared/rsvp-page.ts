type EventShape = {
  name?: string | null
  event_date?: string | null
  venue?: string | null
}

function buildEventSummary(event?: EventShape | null) {
  const summary: string[] = []

  if (event?.event_date) summary.push(event.event_date)
  if (event?.venue) summary.push(event.venue)

  return summary.join(' - ')
}

function sanitizeString(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

function sanitizeGalleryUrls(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => sanitizeString(item).trim())
    .filter(Boolean)
    .slice(0, 6)
}

function sanitizeFaqItems(value: unknown) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => ({
      question: sanitizeString(item?.question).trim(),
      answer: sanitizeString(item?.answer).trim(),
    }))
    .filter((item) => item.question || item.answer)
    .slice(0, 6)
}

function sanitizeThemeKey(value: unknown, fallback = 'editorial') {
  const normalized = sanitizeString(value, fallback).trim().toLowerCase()
  return ['editorial', 'romantic', 'minimal', 'garden'].includes(normalized) ? normalized : fallback
}

function sanitizeHeroAlignment(value: unknown, fallback = 'center') {
  return ['left', 'center'].includes(String(value)) ? String(value) : fallback
}

export function buildDefaultRsvpPageConfig(event?: EventShape | null) {
  return {
    branding: {
      hero_image_url: '',
      logo_image_url: '',
      gallery_urls: [],
      primary_color: '#7c5847',
      secondary_color: '#f6ede7',
      accent_color: '#a46c47',
      heading_font: 'playfair',
      body_font: 'inter',
    },
    content: {
      welcome_badge: 'RSVP',
      welcome_title: 'Confirma tu asistencia',
      welcome_message: 'Nos encantara compartir este momento contigo. Revisa la informacion y responde en unos segundos.',
      couple_names: event?.name || '',
      event_summary: buildEventSummary(event),
      dress_code_title: 'Dress code',
      dress_code_text: '',
      gift_title: 'Mesa de regalos',
      gift_text: '',
      gift_url: '',
      map_title: 'Como llegar',
      map_embed_url: '',
      faq_title: 'Preguntas frecuentes',
      faq_items: [],
      confirmation_success_title: 'Respuesta registrada',
      confirmation_success_message: 'Gracias por confirmar. Tu respuesta ya quedo guardada.',
    },
    visibility: {
      show_logo: true,
      show_gallery: false,
      show_dress_code: false,
      show_gift: false,
      show_map: false,
      show_faq: false,
    },
    layout: {
      template_key: 'editorial',
      hero_alignment: 'center',
    },
  }
}

export function normalizePublishedRsvpPageConfig(config: Record<string, unknown> | null | undefined, event?: EventShape | null) {
  const defaults = buildDefaultRsvpPageConfig(event)
  const branding = config?.branding && typeof config.branding === 'object' ? config.branding as Record<string, unknown> : {}
  const content = config?.content && typeof config.content === 'object' ? config.content as Record<string, unknown> : {}
  const visibility = config?.visibility && typeof config.visibility === 'object' ? config.visibility as Record<string, unknown> : {}
  const layout = config?.layout && typeof config.layout === 'object' ? config.layout as Record<string, unknown> : {}

  return {
    branding: {
      ...defaults.branding,
      ...branding,
      gallery_urls: sanitizeGalleryUrls(branding.gallery_urls),
      heading_font: sanitizeString(branding.heading_font, defaults.branding.heading_font),
      body_font: sanitizeString(branding.body_font, defaults.branding.body_font),
    },
    content: {
      ...defaults.content,
      ...content,
      faq_items: sanitizeFaqItems(content.faq_items),
    },
    visibility: {
      ...defaults.visibility,
      ...visibility,
      show_logo: Boolean(visibility.show_logo ?? defaults.visibility.show_logo),
      show_gallery: Boolean(visibility.show_gallery ?? defaults.visibility.show_gallery),
      show_dress_code: Boolean(visibility.show_dress_code ?? defaults.visibility.show_dress_code),
      show_gift: Boolean(visibility.show_gift ?? defaults.visibility.show_gift),
      show_map: Boolean(visibility.show_map ?? defaults.visibility.show_map),
      show_faq: Boolean(visibility.show_faq ?? defaults.visibility.show_faq),
    },
    layout: {
      ...defaults.layout,
      ...layout,
      template_key: sanitizeThemeKey(layout.template_key, defaults.layout.template_key),
      hero_alignment: sanitizeHeroAlignment(layout.hero_alignment, defaults.layout.hero_alignment),
    },
  }
}
