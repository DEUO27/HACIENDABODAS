import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { assertEventAccess } from '../_shared/auth.ts'
import { corsHeaders } from '../_shared/cors.ts'
import { buildTemplatePayload, issueTokenForGuest, sendViaMetaTemplate } from '../_shared/whatsapp.ts'

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
    const body = await req.json()

    const eventId = body.eventId
    const messageKey = String(body.messageKey || 'invitation_main').trim()
    const guestIds = Array.isArray(body.guestIds) ? body.guestIds : []
    const baseUrl = String(body.baseUrl || '').trim()
    const scheduledAt = body.scheduledAt || null
    const throttleMs = Math.min(Math.max(Number(body.throttleMs || 350), 150), 5000)

    if (!eventId || !messageKey || !baseUrl || !guestIds.length) {
      return jsonResponse({ error: 'eventId, messageKey, guestIds y baseUrl son obligatorios.' }, 400)
    }

    const { adminClient } = await assertEventAccess(req, String(eventId), {
      allowedGlobalRoles: ['admin', 'planner', 'esposos'],
      allowedMembershipRoles: ['planner', 'esposos'],
    })

    const { data: blueprint, error: blueprintError } = await adminClient
      .from('message_blueprints')
      .select('*')
      .eq('channel', 'whatsapp')
      .eq('message_key', messageKey)
      .eq('is_active', true)
      .maybeSingle()

    if (blueprintError) throw blueprintError
    if (!blueprint || !blueprint.meta_template_name || !blueprint.reference_body) {
      return jsonResponse({ error: 'Este mensaje aun no esta configurado para envio.' }, 409)
    }

    const { data: event, error: eventError } = await adminClient
      .from('events')
      .select('id, name, event_date')
      .eq('id', eventId)
      .maybeSingle()

    if (eventError) throw eventError
    if (!event) return jsonResponse({ error: 'Evento no encontrado.' }, 404)

    const { data: guests, error: guestsError } = await adminClient
      .from('guests')
      .select('id, event_id, full_name, phone, attendance_status, plus_ones_allowed, guest_group, table_name, tags')
      .eq('event_id', eventId)
      .in('id', guestIds)

    if (guestsError) throw guestsError

    const isScheduled = Boolean(scheduledAt && new Date(scheduledAt).getTime() > Date.now())
    let scheduled = 0
    let sent = 0
    let failed = 0

    for (const guest of guests || []) {
      const rsvpLink = await issueTokenForGuest(adminClient, guest, baseUrl)
      const payloadBuilder = buildTemplatePayload({
        guest,
        event,
        baseUrl,
        blueprint,
      })
      const { renderedMessage, providerPayload } = payloadBuilder.buildFromLink(rsvpLink)

      if (isScheduled) {
        const { error: deliveryError } = await adminClient
          .from('message_deliveries')
          .insert({
            event_id: eventId,
            guest_id: guest.id,
            channel: 'whatsapp',
            message_key: messageKey,
            rendered_message: renderedMessage,
            recipient_phone: guest.phone,
            scheduled_at: scheduledAt,
            status: 'scheduled',
            provider_payload: providerPayload,
          })

        if (deliveryError) throw deliveryError

        await adminClient
          .from('guests')
          .update({ delivery_status: 'scheduled' })
          .eq('id', guest.id)

        scheduled += 1
        continue
      }

      const now = new Date().toISOString()
      const { data: queuedDelivery, error: queueError } = await adminClient
        .from('message_deliveries')
        .insert({
          event_id: eventId,
          guest_id: guest.id,
          channel: 'whatsapp',
          message_key: messageKey,
          rendered_message: renderedMessage,
          recipient_phone: guest.phone,
          status: 'queued',
          attempts: 0,
          provider_payload: providerPayload,
        })
        .select('id')
        .single()

      if (queueError) throw queueError

      const sendResult = await sendViaMetaTemplate(
        guest.phone,
        providerPayload.template_name,
        providerPayload.language_code,
        providerPayload.parameter_values,
      )

      const deliveryStatus = sendResult.ok ? 'sent' : 'failed'

      await adminClient
        .from('message_deliveries')
        .update({
          status: deliveryStatus,
          sent_at: sendResult.ok ? now : null,
          provider_message_id: sendResult.providerMessageId,
          error_code: sendResult.ok ? null : sendResult.error,
          attempts: 1,
          provider_payload: {
            ...providerPayload,
            meta_response: sendResult.payload || {},
          },
        })
        .eq('id', queuedDelivery.id)

      await adminClient
        .from('guests')
        .update({
          delivery_status: deliveryStatus,
          last_delivery_at: sendResult.ok ? now : null,
        })
        .eq('id', guest.id)

      if (sendResult.ok) sent += 1
      else failed += 1

      await sleep(throttleMs)
    }

    return jsonResponse({
      total: guests?.length || 0,
      scheduled,
      sent,
      failed,
    })
  } catch (error) {
    if (error instanceof Response) {
      const body = await error.text()
      return new Response(body, {
        status: error.status,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      })
    }

    console.error('[send-whatsapp-batch]', error)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Unexpected error.' }, 500)
  }
})
