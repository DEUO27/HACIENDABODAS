import { formatEventDate } from '@/lib/eventModuleUtils'

export const RSVP_THEME_CATALOG = [
  {
    key: 'editorial',
    label: 'Editorial',
    description: 'Portada amplia, tipografia elegante y composicion tipo revista.',
  },
  {
    key: 'romantic',
    label: 'Romantica',
    description: 'Colores suaves, hero centrado y tono calido para confirmaciones.',
  },
  {
    key: 'minimal',
    label: 'Minimal',
    description: 'Diseno limpio y sobrio con foco total en la informacion esencial.',
  },
  {
    key: 'garden',
    label: 'Garden',
    description: 'Visual organico con acentos verdes e imagenes protagonistas.',
  },
]

export const RSVP_HEADING_FONT_OPTIONS = [
  { key: 'playfair', label: 'Playfair Display', family: '\'Playfair Display\', Georgia, serif' },
  { key: 'cormorant', label: 'Cormorant Garamond', family: '\'Cormorant Garamond\', Garamond, serif' },
  { key: 'bellefair', label: 'Bellefair', family: '\'Bellefair\', Baskerville, serif' },
]

export const RSVP_BODY_FONT_OPTIONS = [
  { key: 'inter', label: 'Inter', family: 'Inter, system-ui, sans-serif' },
  { key: 'lora', label: 'Lora', family: '\'Lora\', Georgia, serif' },
  { key: 'source_sans', label: 'Source Sans', family: '\'Source Sans 3\', system-ui, sans-serif' },
]

const THEME_KEYS = new Set(RSVP_THEME_CATALOG.map((theme) => theme.key))

function buildEventSummary(event) {
  const summary = []
  const eventDate = event?.eventDate || event?.event_date
  const venue = event?.venue || ''

  if (eventDate) summary.push(formatEventDate(eventDate))
  if (venue) summary.push(venue)

  return summary.join(' · ')
}

export function buildDefaultRsvpPageConfig(event = null) {
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

function sanitizeString(value, fallback = '') {
  return typeof value === 'string' ? value : fallback
}

export function normalizeRsvpMapEmbedUrl(rawUrl) {
  const value = sanitizeString(rawUrl).trim()
  if (!value) return ''

  try {
    const url = new URL(value)
    const hostname = url.hostname.replace(/^www\./, '')

    if ((hostname === 'google.com' || hostname === 'maps.google.com') && url.pathname.startsWith('/maps/embed')) {
      return value
    }

    if ((hostname === 'google.com' || hostname === 'maps.google.com') && url.pathname.startsWith('/maps')) {
      const coordinates = value.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/)
      if (coordinates) {
        return `https://www.google.com/maps?q=${coordinates[1]},${coordinates[2]}&z=16&output=embed`
      }

      const placeMatch = decodeURIComponent(url.pathname).match(/\/maps\/place\/([^/]+)/)
      if (placeMatch?.[1]) {
        return `https://www.google.com/maps?q=${encodeURIComponent(placeMatch[1].replace(/\+/g, ' '))}&output=embed`
      }

      const query = url.searchParams.get('q') || url.searchParams.get('query')
      if (query) {
        return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`
      }
    }

    if (hostname === 'maps.google.com' && url.searchParams.get('output') === 'embed') {
      return value
    }
  } catch {
    return ''
  }

  return ''
}

function sanitizeGalleryUrls(value) {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => sanitizeString(item).trim())
    .filter(Boolean)
    .slice(0, 6)
}

function sanitizeFaqItems(value) {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => ({
      question: sanitizeString(item?.question).trim(),
      answer: sanitizeString(item?.answer).trim(),
    }))
    .filter((item) => item.question || item.answer)
    .slice(0, 6)
}

function sanitizeThemeKey(value, fallback = 'editorial') {
  const normalized = sanitizeString(value, fallback).trim().toLowerCase()
  return THEME_KEYS.has(normalized) ? normalized : fallback
}

function sanitizeHeroAlignment(value, fallback = 'center') {
  return ['left', 'center'].includes(value) ? value : fallback
}

export function mergeRsvpPageConfig(baseConfig = {}, nextConfig = {}, event = null) {
  const defaults = buildDefaultRsvpPageConfig(event)

  const branding = {
    ...defaults.branding,
    ...(baseConfig?.branding || {}),
    ...(nextConfig?.branding || {}),
  }

  const content = {
    ...defaults.content,
    ...(baseConfig?.content || {}),
    ...(nextConfig?.content || {}),
  }

  const visibility = {
    ...defaults.visibility,
    ...(baseConfig?.visibility || {}),
    ...(nextConfig?.visibility || {}),
  }

  const layout = {
    ...defaults.layout,
    ...(baseConfig?.layout || {}),
    ...(nextConfig?.layout || {}),
  }

  return {
    branding: {
      ...branding,
      gallery_urls: sanitizeGalleryUrls(nextConfig?.branding?.gallery_urls ?? baseConfig?.branding?.gallery_urls ?? defaults.branding.gallery_urls),
      heading_font: sanitizeString(branding.heading_font, defaults.branding.heading_font),
      body_font: sanitizeString(branding.body_font, defaults.branding.body_font),
    },
    content: {
      ...content,
      faq_items: sanitizeFaqItems(nextConfig?.content?.faq_items ?? baseConfig?.content?.faq_items ?? defaults.content.faq_items),
    },
    visibility: {
      ...visibility,
      show_logo: Boolean(visibility.show_logo),
      show_gallery: Boolean(visibility.show_gallery),
      show_dress_code: Boolean(visibility.show_dress_code),
      show_gift: Boolean(visibility.show_gift),
      show_map: Boolean(visibility.show_map),
      show_faq: Boolean(visibility.show_faq),
    },
    layout: {
      ...layout,
      template_key: sanitizeThemeKey(layout.template_key, defaults.layout.template_key),
      hero_alignment: sanitizeHeroAlignment(layout.hero_alignment, defaults.layout.hero_alignment),
    },
  }
}

export function normalizeEventRsvpPageRecord(record, event = null) {
  const draftConfig = mergeRsvpPageConfig(record?.draft_config || {}, {}, event)
  const publishedConfig = mergeRsvpPageConfig(record?.published_config || {}, {}, event)
  const hasPublished = Boolean(record?.published_at || (record?.status === 'published' && record?.published_config))

  return {
    event_id: record?.event_id || event?.id || null,
    theme_key: sanitizeThemeKey(record?.theme_key || draftConfig.layout.template_key || 'editorial'),
    draft_config: draftConfig,
    published_config: publishedConfig,
    status: record?.status || 'draft',
    published_at: record?.published_at || null,
    created_at: record?.created_at || null,
    updated_at: record?.updated_at || null,
    has_published: hasPublished,
  }
}

export function getRsvpThemeMeta(themeKey) {
  return RSVP_THEME_CATALOG.find((theme) => theme.key === themeKey) || RSVP_THEME_CATALOG[0]
}

export function getRsvpFontFamilies(config) {
  const headingFont = RSVP_HEADING_FONT_OPTIONS.find((item) => item.key === config?.branding?.heading_font) || RSVP_HEADING_FONT_OPTIONS[0]
  const bodyFont = RSVP_BODY_FONT_OPTIONS.find((item) => item.key === config?.branding?.body_font) || RSVP_BODY_FONT_OPTIONS[0]

  return {
    heading: headingFont.family,
    body: bodyFont.family,
  }
}

export function buildRsvpPreviewGuest() {
  return {
    id: 'preview-guest',
    fullName: 'Invitado de ejemplo',
    plusOnesAllowed: 2,
    attendanceStatus: 'pending',
  }
}
