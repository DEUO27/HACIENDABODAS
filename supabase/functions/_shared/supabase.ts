import { createClient } from 'npm:@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || ''
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY') || ''
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  console.warn('Missing Supabase env vars for Punto 2 edge functions.')
}

export function createUserClient(accessToken?: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  })
}

export const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey)
