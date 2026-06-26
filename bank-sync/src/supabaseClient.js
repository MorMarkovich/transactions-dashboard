// Signs into Supabase AS THE USER (email/password) with the anon key, so every
// read/write respects RLS — exactly like the dashboard. The service_role key is
// never used. Writes are insert-only snapshots (never deletes / moves money).
import { createClient } from '@supabase/supabase-js'

export async function signIn(url, anonKey, email, password) {
  const supabase = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`Supabase login failed: ${error.message}`)
  return { supabase, userId: data.user.id }
}

// Most recent saved_transactions snapshot (the dashboard reads the same row).
export async function getLatestSnapshot(supabase, userId) {
  const { data, error } = await supabase
    .from('saved_transactions')
    .select('data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) throw new Error(`read snapshot failed: ${error.message}`)
  const row = data && data[0]
  return row && Array.isArray(row.data) ? row.data : []
}

export async function getCategoryRules(supabase, userId) {
  const { data, error } = await supabase
    .from('user_category_rules')
    .select('merchant, category')
    .eq('user_id', userId)
  if (error) return []
  return data || []
}

// Insert a new snapshot row (insert-only, matching the dashboard's save).
// Returns the new row id.
export async function insertSnapshot(supabase, userId, transactions) {
  const { data, error } = await supabase
    .from('saved_transactions')
    .insert({ user_id: userId, data: transactions })
    .select('id')
    .single()
  if (error) throw new Error(`write snapshot failed: ${error.message}`)
  return data?.id
}

// Prune old snapshots after a fresh re-sync, but KEEP the newest `keepRecent`
// (plus `keepId`) as backups, so a bad run (e.g. a provider blocked mid-sync)
// can be recovered instead of being permanently overwritten. The dashboard
// still reads only the newest row; the rest are just safety copies.
export async function deleteOtherSnapshots(supabase, userId, keepId, keepRecent = 3) {
  const { data, error: selErr } = await supabase
    .from('saved_transactions')
    .select('id')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (selErr) throw new Error(`cleanup of old snapshots failed: ${selErr.message}`)
  const ids = (data || []).map((r) => r.id)
  const keep = new Set([keepId, ...ids.slice(0, Math.max(0, keepRecent))].filter((v) => v != null))
  const toDelete = ids.filter((id) => !keep.has(id))
  if (!toDelete.length) return
  const { error } = await supabase
    .from('saved_transactions')
    .delete()
    .eq('user_id', userId)
    .in('id', toDelete)
  if (error) throw new Error(`cleanup of old snapshots failed: ${error.message}`)
}
