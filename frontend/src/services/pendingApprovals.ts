import { supabase } from '../lib/supabase'

export interface PendingRow {
  identity: string; date: string; merchant: string; authorizationMinor: number
  currency: 'ILS'; status: 'pending'
}
export interface PendingSnapshot {
  success: true; cardKey: string; scope: string; observedAt: string; rows: PendingRow[]
}
export interface PendingCard {
  key: string; company: '11' | '77'; suffix: string
  state: 'current' | 'stale' | 'unknown' | 'rollover_review' | 'retention_limit'
  checkedAt: string; current: PendingSnapshot | null; unresolved: PendingSnapshot[]
}
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const timestamp = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v))
const states = new Set(['current', 'stale', 'unknown', 'rollover_review', 'retention_limit'])
function invalid(): never { throw new Error('pending_read_failed') }

// Reject the entire response on a malformed/cross-card scope. Never turn a
// partial read into a successful empty list, or infer that a row became posted.
export function parsePendingCards(value: unknown): PendingCard[] {
  if (!Array.isArray(value) || value.length > 20) return invalid()
  const keys = new Set<string>()
  return value.map(item => {
    if (!object(item) || typeof item.card_key !== 'string' || !Number.isSafeInteger(item.version) || Number(item.version) < 1) return invalid()
    const key = item.card_key
    if (keys.has(key)) return invalid()
    keys.add(key)
    let parts: unknown
    try { parts = JSON.parse(key) } catch { return invalid() }
    if (!Array.isArray(parts) || parts.length !== 5 || JSON.stringify(parts) !== key || parts[0] !== 'isracard' ||
        typeof parts[1] !== 'string' || !/^pending-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parts[1]) ||
        !['11', '77'].includes(parts[2]) || typeof parts[3] !== 'boolean' || !/^\d{4}$/.test(parts[4])) return invalid()
    const data = item.data
    if (!object(data) || !states.has(String(data.state)) || !timestamp(data.checkedAt) || !Array.isArray(data.unresolved) || data.unresolved.length > 12 ||
        new TextEncoder().encode(JSON.stringify(data)).length > 262_144) return invalid()
    const snapshot = (raw: unknown): PendingSnapshot => {
      if (!object(raw) || raw.success !== true || raw.cardKey !== key || typeof raw.scope !== 'string' ||
          !raw.scope.startsWith(`${key}|`) || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw.scope.slice(key.length + 1)) ||
          !timestamp(raw.observedAt) || !Array.isArray(raw.rows) || raw.rows.length > 1000) return invalid()
      const ids = new Set<string>()
      const rows = raw.rows.map((row): PendingRow => {
        if (!object(row) || typeof row.identity !== 'string' || !row.identity || row.identity.length > 2048 || ids.has(row.identity) ||
            typeof row.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.date) || !Number.isFinite(Date.parse(`${row.date}T12:00:00Z`)) ||
            new Date(`${row.date}T12:00:00Z`).toISOString().slice(0, 10) !== row.date ||
            typeof row.merchant !== 'string' || !row.merchant.trim() || row.merchant.length > 500 ||
            !Number.isSafeInteger(row.authorizationMinor) || row.currency !== 'ILS' || row.status !== 'pending') return invalid()
        let identity: unknown
        try { identity = JSON.parse(row.identity) } catch { return invalid() }
        if (!Array.isArray(identity) || identity.length !== 4 || identity[0] !== raw.scope || !Number.isSafeInteger(identity[1]) || identity[1] < 0 ||
            typeof identity[2] !== 'string' || !identity[2].trim() || typeof identity[3] !== 'string' || !identity[3].trim()) return invalid()
        ids.add(row.identity)
        return { identity: row.identity, date: row.date, merchant: row.merchant, authorizationMinor: Number(row.authorizationMinor), currency: 'ILS', status: 'pending' }
      })
      return { success: true, cardKey: key, scope: raw.scope, observedAt: raw.observedAt, rows }
    }
    const current = data.current === null ? null : snapshot(data.current)
    if (!current && data.state !== 'unknown') return invalid()
    const unresolved = data.unresolved.map(snapshot)
    if (new Set(unresolved.map(s => s.scope)).size !== unresolved.length) return invalid()
    return { key, company: parts[2], suffix: parts[4], state: data.state as PendingCard['state'], checkedAt: data.checkedAt, current, unresolved }
  })
}

export async function readPendingCards(userId: string, signal: AbortSignal): Promise<PendingCard[]> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return invalid()
  const { data, error } = await supabase.from('pending_card_snapshots')
    .select('card_key,version,data').eq('user_id', userId).order('card_key').limit(21).abortSignal(signal)
  if (error) return invalid()
  return parsePendingCards(data)
}

export function isPendingStale(card: PendingCard, now = Date.now()): boolean {
  const observed = Date.parse(card.current?.observedAt ?? '')
  return card.state === 'stale' || card.state === 'retention_limit' || !Number.isFinite(observed) ||
    observed > now + 300_000 || now - observed > 86_400_000
}
