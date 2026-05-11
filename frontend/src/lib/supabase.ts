import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  // Fail loudly in dev rather than silently creating a broken client that
  // returns cryptic "supabaseUrl is required" errors at the first auth call.
  const missing = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabaseKey && 'VITE_SUPABASE_ANON_KEY',
  ].filter(Boolean).join(', ')
  throw new Error(
    `Missing Supabase env vars: ${missing}. Set them in frontend/.env.local and restart the dev server.`,
  )
}

export const supabase = createClient(supabaseUrl, supabaseKey)
