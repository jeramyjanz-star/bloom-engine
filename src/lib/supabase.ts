import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl) {
  throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL')
}

if (!supabaseAnonKey) {
  throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

if (!supabaseServiceRoleKey) {
  throw new Error('Missing env var: SUPABASE_SERVICE_ROLE_KEY')
}

/**
 * Browser/public client — safe to use in client components and API routes
 * that do not require elevated privileges.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/**
 * Server-only admin client — uses the service role key which bypasses RLS.
 * Never expose this client or its key to the browser.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
