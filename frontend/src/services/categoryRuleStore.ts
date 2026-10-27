import type { SupabaseClient } from '@supabase/supabase-js'
import type { CategoryRule } from './types'

// Same canonical key as normalize_merchant / generated normalizeMerchant.
export function merchantRuleKey(value: string): string {
  return value.trim().replace(/\s*\(תשלום \d+\/\d+\)\s*$/, '')
    .replace(/^(?:PAYPAL|PP|GOOGLE|FACEBK|FB)\s*\*\s*/i, '')
    .replace(/\s+/g, ' ').toLowerCase().trim()
    .replace(/^bolt euo\d{10,}$/, 'bolt euo')
}

function rowsFor(userId: string, rules: CategoryRule[], source: 'manual' | 'ai') {
  const rows = new Map<string, Record<string, unknown>>()
  for (const rule of rules) {
    const merchant = merchantRuleKey(rule.merchant)
    if (!merchant || !rule.category) continue
    rows.set(merchant, {
      user_id: userId, merchant, category: rule.category,
      ...(source === 'manual' || rule.subcategory !== undefined
        ? { subcategory: rule.subcategory || null } : {}),
      source, updated_at: new Date().toISOString(),
    })
  }
  return [...rows.values()]
}

export async function persistManualRules(client: SupabaseClient, userId: string, rules: CategoryRule[]) {
  const rows = rowsFor(userId, rules, 'manual')
  if (!rows.length) return
  const { error } = await client.from('user_category_rules')
    .upsert(rows, { onConflict: 'user_id,merchant' })
  if (error) throw error
}

export async function persistAutomaticRules(client: SupabaseClient, userId: string, rules: CategoryRule[]) {
  const rows = rowsFor(userId, rules, 'ai')
  if (!rows.length) return
  // Insert without overwriting any existing choice. The conditional update
  // below is atomic even if a manual edit finishes while AI is in flight.
  const { error } = await client.from('user_category_rules')
    .upsert(rows, { onConflict: 'user_id,merchant', ignoreDuplicates: true })
  if (error) throw error
  for (const row of rows) {
    if (!('subcategory' in row)) {
      // A changed parent invalidates its old subcategory; a verification of
      // the same parent must retain the existing refinement.
      const { error: resetError } = await client.from('user_category_rules')
        .update({ subcategory: null }).eq('user_id', userId).eq('merchant', row.merchant)
        .eq('source', 'ai').neq('category', row.category)
      if (resetError) throw resetError
    }
    const { error: updateError } = await client.from('user_category_rules')
      .update(row).eq('user_id', userId).eq('merchant', row.merchant).eq('source', 'ai')
    if (updateError) throw updateError
  }
}
