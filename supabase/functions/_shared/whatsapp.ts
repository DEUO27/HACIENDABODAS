const META_ACCESS_TOKEN = Deno.env.get('META_ACCESS_TOKEN') || ''
const META_PHONE_NUMBER_ID = Deno.env.get('META_PHONE_NUMBER_ID') || ''

function normalizePhone(phone: string) {
  return String(phone || '').replace(/\D/g, '')
}

export function formatEventDate(value: string | null) {
  if (!value) return 'sin fecha definida'
  const date = new Date(`${value}T00:00:00`)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function renderReferenceTemplate(template: string, variables: Record<string, string>) {
  return String(template || '').replace(/\{([a-z_]+)\}/gi, (_, key) => variables[key] ?? '')
}

export function extractTemplateKeys(template: string) {
  const matches = String(template || '').matchAll(/\{([a-z_]+)\}/gi)
  const keys: string[] = []

  for (const match of matches) {
    const key = String(match[1] || '').toLowerCase()
    if (!key || keys.includes(key)) continue
    keys.push(key)
  }

  return keys
}

function buildRsvpUrl(baseUrl: string, token: string) {
  return `${String(baseUrl).replace(/\/$/, '')}/rsvp/${String(token || '').replace(/^\/+/, '')}`
}

export async function issueTokenForGuest(adminClient: any, guest: any, baseUrl: string) {
  const { data, error } = await adminClient.rpc('issue_guest_rsvp_token_core', {
    p_guest_id: guest.id,
    p_event_id: guest.event_id,
    p_expires_at: null,
  })

  if (error) throw error

  const result = Array.isArray(data) ? data[0] : data

  if (!result?.token) {
    throw new Error('No fue posible emitir el token RSVP.')
  }

  return buildRsvpUrl(baseUrl, result.token)
}

export function buildTemplatePayload({
  guest,
  event,
  baseUrl,
  blueprint,
}: {
  guest: any
  event: any
  baseUrl: string
  blueprint: any
}) {
  const link = `${String(baseUrl).replace(/\/$/, '')}/rsvp/<link-personalizado>`
  const templateKeys = extractTemplateKeys(blueprint.reference_body)

  return {
    templateKeys,
    buildFromLink(rsvpLink: string) {
      const templateVariables: Record<string, string> = {
        nombre: guest.full_name,
        evento: event.name,
        fecha: formatEventDate(event.event_date),
        link_confirmacion: rsvpLink || link,
      }

      return {
        renderedMessage: renderReferenceTemplate(blueprint.reference_body, templateVariables),
        providerPayload: {
          message_key: blueprint.message_key,
          template_name: blueprint.meta_template_name,
          language_code: blueprint.language_code,
          parameter_keys: templateKeys,
          parameter_values: templateKeys.map((key) => templateVariables[key] ?? ''),
        },
      }
    },
  }
}

export async function sendViaMetaTemplate(
  recipientPhone: string,
  templateName: string,
  languageCode: string,
  parameters: string[],
) {
  if (!META_ACCESS_TOKEN || !META_PHONE_NUMBER_ID) {
    return {
      ok: false,
      error: 'Missing META_ACCESS_TOKEN or META_PHONE_NUMBER_ID.',
    }
  }

  const normalizedPhone = normalizePhone(recipientPhone)
  if (!normalizedPhone) {
    return {
      ok: false,
      error: 'Recipient phone is missing or invalid.',
    }
  }

  const bodyParameters = parameters.map((value) => ({
    type: 'text',
    text: String(value || ''),
  }))

  const requestBody: Record<string, unknown> = {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to: normalizedPhone,
    type: 'template',
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
    },
  }

  if (bodyParameters.length) {
    requestBody.template = {
      ...(requestBody.template as Record<string, unknown>),
      components: [
        {
          type: 'body',
          parameters: bodyParameters,
        },
      ],
    }
  }

  const response = await fetch(`https://graph.facebook.com/v22.0/${META_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${META_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  })

  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    return {
      ok: false,
      error: payload?.error?.message || `Meta API error ${response.status}`,
      payload,
    }
  }

  return {
    ok: true,
    payload,
    providerMessageId: payload?.messages?.[0]?.id || null,
  }
}
