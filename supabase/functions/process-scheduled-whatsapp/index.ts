import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { corsHeaders } from '../_shared/cors.ts'
import { adminClient } from '../_shared/supabase.ts'
import { sendViaMetaTemplate } from '../_shared/whatsapp.ts'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const cronSecret = req.headers.get('x-cron-secret') || ''
    const { data: schedulerConfig, error: schedulerError } = await adminClient
      .from('message_scheduler_config')
      .select('cron_secret')
      .eq('id', true)
      .maybeSingle()

    if (schedulerError) throw schedulerError
    if (!schedulerConfig || !cronSecret || cronSecret !== schedulerConfig.cron_secret) {
      return jsonResponse({ error: 'Forbidden' }, 403)
    }

    const throttleMs = Math.min(Math.max(Number(req.headers.get('x-throttle-ms') || 350), 150), 5000)
    const now = new Date().toISOString()

    const { data: deliveries, error: deliveriesError } = await adminClient
      .from('message_deliveries')
      .select('id, guest_id, recipient_phone, attempts, provider_payload')
      .eq('channel', 'whatsapp')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)
      .order('scheduled_at', { ascending: true })

    if (deliveriesError) throw deliveriesError

    let sent = 0
    let failed = 0

    for (const delivery of deliveries || []) {
      const templatePayload = delivery.provider_payload || {}
      const sendResult = await sendViaMetaTemplate(
        delivery.recipient_phone,
        String(templatePayload.template_name || '').trim(),
        String(templatePayload.language_code || 'es_MX').trim(),
        Array.isArray(templatePayload.parameter_values) ? templatePayload.parameter_values : [],
      )

      const deliveryStatus = sendResult.ok ? 'accepted' : 'failed'
      const sentAt = sendResult.ok ? new Date().toISOString() : null

      await adminClient
        .from('message_deliveries')
        .update({
          status: deliveryStatus,
          sent_at: sentAt,
          provider_message_id: sendResult.providerMessageId,
          error_code: sendResult.ok ? null : sendResult.error,
          attempts: Number(delivery.attempts || 0) + 1,
          provider_payload: {
            ...templatePayload,
            meta_response: sendResult.payload || {},
          },
        })
        .eq('id', delivery.id)

      await adminClient
        .from('guests')
        .update({
          delivery_status: deliveryStatus,
          last_delivery_at: sentAt,
        })
        .eq('id', delivery.guest_id)

      if (sendResult.ok) sent += 1
      else failed += 1

      await sleep(throttleMs)
    }

    return jsonResponse({
      processed: (deliveries || []).length,
      sent,
      failed,
    })
  } catch (error) {
    console.error('[process-scheduled-whatsapp]', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error.' }, 500)
  }
})
