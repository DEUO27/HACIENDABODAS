import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { corsHeaders } from '../_shared/cors.ts'
import { adminClient } from '../_shared/supabase.ts'

const META_VERIFY_TOKEN = Deno.env.get('META_VERIFY_TOKEN') || Deno.env.get('META_WEBHOOK_VERIFY_TOKEN') || ''
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

type SignatureValidationResult = 'valid' | 'missing_secret' | 'missing_signature' | 'invalid_signature'

function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || !/^[a-f0-9]+$/i.test(hex)) return null

  const bytes = new Uint8Array(hex.length / 2)
  for (let index = 0; index < hex.length; index += 2) {
    bytes[index / 2] = parseInt(hex.slice(index, index + 2), 16)
  }

  return bytes
}

function timingSafeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false

  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index]
  }

  return difference === 0
}

async function validateWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<SignatureValidationResult> {
  if (!META_APP_SECRET) {
    return 'missing_secret'
  }

  if (!signatureHeader) return 'missing_signature'

  const expectedPrefix = 'sha256='
  if (!signatureHeader.startsWith(expectedPrefix)) return 'invalid_signature'

  const receivedHex = signatureHeader.slice(expectedPrefix.length)
  const receivedBytes = hexToBytes(receivedHex)
  if (!receivedBytes) return 'invalid_signature'

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(META_APP_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody))
  const computedBytes = new Uint8Array(signature)

  return timingSafeEqual(computedBytes, receivedBytes) ? 'valid' : 'invalid_signature'
}

function mapMetaStatus(status: string) {
  const normalizedStatus = String(status || '').toLowerCase()

  if (['sent', 'delivered', 'read', 'failed'].includes(normalizedStatus)) {
    return normalizedStatus
  }

  return 'sent'
}

function getMetaError(statusEvent: any) {
  const error = Array.isArray(statusEvent?.errors) ? statusEvent.errors[0] : null

  if (!error) return null

  return error.message || error.title || error.code || 'meta_failed'
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
        console.info('[whatsapp-status-webhook] verification_success')
        return new Response(challenge || '', { status: 200, headers: corsHeaders })
      }

      console.warn('[whatsapp-status-webhook] verification_failed')
      return new Response('Forbidden', { status: 403, headers: corsHeaders })
    }

    const rawBody = await req.text()
    const signatureHeader = req.headers.get('X-Hub-Signature-256')

    const signatureResult = await validateWebhookSignature(rawBody, signatureHeader)

    if (signatureResult === 'missing_secret') {
      console.error('[whatsapp-status-webhook] webhook_config_missing: META_APP_SECRET is required.')
      return jsonResponse({ error: 'webhook_not_configured' }, 500)
    }

    if (signatureResult !== 'valid') {
      console.warn('[whatsapp-status-webhook] invalid_signature', JSON.stringify({ reason: signatureResult }))
      return jsonResponse({ error: 'invalid_signature' }, 403)
    }

    const body = JSON.parse(rawBody)
    const statuses = (body.entry || [])
      .flatMap((entry: any) => entry.changes || [])
      .flatMap((change: any) => change.value?.statuses || [])
    const inboundMessages = (body.entry || [])
      .flatMap((entry: any) => entry.changes || [])
      .flatMap((change: any) => change.value?.messages || [])

    console.info('[whatsapp-status-webhook] received', JSON.stringify({
      statuses: statuses.length,
      inboundMessages: inboundMessages.length,
    }))

    let updated = 0
    let unmatched = 0

    for (const statusEvent of statuses) {
      const deliveryStatus = mapMetaStatus(statusEvent.status)
      const statusAt = statusEvent.timestamp
        ? new Date(Number(statusEvent.timestamp) * 1000).toISOString()
        : new Date().toISOString()
      const metaError = getMetaError(statusEvent)

      const { data: delivery, error: deliveryLookupError } = await adminClient
        .from('message_deliveries')
        .select('id, guest_id, sent_at, provider_payload')
        .eq('provider_message_id', statusEvent.id)
        .maybeSingle()

      if (deliveryLookupError) throw deliveryLookupError

      if (!delivery) {
        unmatched += 1
        console.warn('[whatsapp-status-webhook] unmatched_status', JSON.stringify({
          messageId: statusEvent.id,
          status: statusEvent.status,
        }))
        continue
      }

      const currentProviderPayload = delivery.provider_payload && typeof delivery.provider_payload === 'object'
        ? delivery.provider_payload
        : {}
      const webhookHistory = Array.isArray(currentProviderPayload.webhook_history)
        ? currentProviderPayload.webhook_history
        : []

      const { error: deliveryUpdateError } = await adminClient
        .from('message_deliveries')
        .update({
          status: deliveryStatus,
          sent_at: deliveryStatus === 'failed' ? delivery.sent_at : statusAt,
          error_code: deliveryStatus === 'failed' ? metaError : null,
          provider_payload: {
            ...currentProviderPayload,
            webhook_status: statusEvent,
            webhook_history: [...webhookHistory, statusEvent].slice(-20),
          },
        })
        .eq('id', delivery.id)

      if (deliveryUpdateError) throw deliveryUpdateError

      updated += 1

      if (delivery.guest_id) {
        await adminClient
          .from('guests')
          .update({
            delivery_status: deliveryStatus,
            last_delivery_at: deliveryStatus === 'failed' ? delivery.sent_at : statusAt,
          })
          .eq('id', delivery.guest_id)
      }
    }

    return jsonResponse({
      received: statuses.length,
      updated,
      unmatched,
      inboundMessages: inboundMessages.length,
    })
  } catch (error) {
    console.error('[whatsapp-status-webhook]', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error.' }, 500)
  }
})
