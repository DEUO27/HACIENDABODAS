import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { corsHeaders } from '../_shared/cors.ts'
import { adminClient } from '../_shared/supabase.ts'

const META_VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN') || ''
const META_APP_SECRET = Deno.env.get('META_APP_SECRET') || ''

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function validateWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!META_APP_SECRET) {
    console.warn('[whatsapp-status-webhook] META_APP_SECRET not set, skipping signature validation.')
    return true
  }

  if (!signatureHeader) return false

  const expectedPrefix = 'sha256='
  if (!signatureHeader.startsWith(expectedPrefix)) return false

  const receivedHex = signatureHeader.slice(expectedPrefix.length)

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(META_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const computedHex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  return computedHex === receivedHex
}

function mapMetaStatus(status: string) {
  if (status === 'failed') return 'failed'
  return 'sent'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)

    if (req.method === 'GET') {
      const mode = url.searchParams.get('hub.mode')
      const verifyToken = url.searchParams.get('hub.verify_token')
      const challenge = url.searchParams.get('hub.challenge')

      if (mode === 'subscribe' && verifyToken === META_VERIFY_TOKEN) {
        return new Response(challenge || '', { status: 200, headers: corsHeaders })
      }

      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    const rawBody = await req.text()
    const signatureHeader = req.headers.get('X-Hub-Signature-256')

    const isValid = await validateWebhookSignature(rawBody, signatureHeader)
    if (!isValid) {
      console.warn('[whatsapp-status-webhook] Invalid signature.')
      return jsonResponse({ error: 'Invalid signature.' }, 403)
    }

    const body = JSON.parse(rawBody)
    const statuses = (body.entry || [])
      .flatMap((entry: any) => entry.changes || [])
      .flatMap((change: any) => change.value?.statuses || [])

    for (const statusEvent of statuses) {
      const deliveryStatus = mapMetaStatus(statusEvent.status)
      const sentAt = statusEvent.timestamp
        ? new Date(Number(statusEvent.timestamp) * 1000).toISOString()
        : new Date().toISOString()

      const { data: delivery } = await adminClient
        .from('message_deliveries')
        .update({
          status: deliveryStatus,
          sent_at: deliveryStatus === 'sent' ? sentAt : null,
          error_code: deliveryStatus === 'failed' ? statusEvent.errors?.[0]?.title || 'meta_failed' : null,
          provider_payload: statusEvent,
        })
        .eq('provider_message_id', statusEvent.id)
        .select('guest_id')
        .maybeSingle()

      if (delivery?.guest_id) {
        await adminClient
          .from('guests')
          .update({
            delivery_status: deliveryStatus,
            last_delivery_at: deliveryStatus === 'sent' ? sentAt : null,
          })
          .eq('id', delivery.guest_id)
      }
    }

    return jsonResponse({ received: statuses.length })
  } catch (error) {
    console.error('[whatsapp-status-webhook]', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error.' }, 500)
  }
})
