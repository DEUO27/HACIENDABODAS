import 'jsr:@supabase/functions-js/edge-runtime.d.ts'

import { corsHeaders } from '../_shared/cors.ts'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

Deno.serve((req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.warn('[issue-rsvp-token] legacy_endpoint_disabled')

  return jsonResponse({
    error: 'legacy_disabled',
    message: 'Este endpoint fue reemplazado por la RPC issue_guest_rsvp_token.',
  }, 410)
})
