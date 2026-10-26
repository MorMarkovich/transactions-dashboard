import { describe, it, expect, vi } from 'vitest'
vi.mock('../lib/supabase', () => ({ supabase: {} }))
import { parsePendingCards, isPendingStale } from './pendingApprovals'

export function pendingFixture() {
  const key = JSON.stringify(['isracard', 'pending-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11', false, '1234'])
  const scope = `${key}|2026-11`
  return [{ card_key: key, version: 1, data: { state: 'current', checkedAt: '2026-10-26T10:00:00Z', unresolved: [],
    current: { cardKey: key, scope, success: true, observedAt: '2026-10-26T10:00:00Z', rows: Array.from({ length: 4 }, (_, i) => ({
      identity: JSON.stringify([scope, 1, `000${i}`, `synthetic-${i}`]), date: '2026-10-25', merchant: `עסקת דוגמה ${i + 1}`,
      authorizationMinor: 1000 + i, currency: 'ILS', status: 'pending',
    })) },
  } }]
}
describe('pending snapshot read contract', () => {
  it('preserves four distinct approvals and their signed minor units', () => {
    const input = pendingFixture(); input[0].data.current.rows[3].authorizationMinor = -250
    const cards = parsePendingCards(input)
    expect(cards[0].current?.rows).toHaveLength(4)
    expect(cards[0].current?.rows[3].authorizationMinor).toBe(-250)
    expect(input[0].data.current.rows).toHaveLength(4)
  })
  it.each(['wrong-card', 'duplicate', 'bad-date', 'fx', 'unsafe-amount', 'wrong-scope', 'partial', 'duplicate-card'])('rejects %s rather than rendering empty or mixing cards', mode => {
    const input = pendingFixture(); const snapshot = input[0].data.current
    if (mode === 'wrong-card') snapshot.cardKey = 'other'
    if (mode === 'duplicate') snapshot.rows[1].identity = snapshot.rows[0].identity
    if (mode === 'bad-date') snapshot.rows[0].date = '2026-02-31'
    if (mode === 'fx') snapshot.rows[0].currency = 'USD'
    if (mode === 'unsafe-amount') snapshot.rows[0].authorizationMinor = Number.MAX_SAFE_INTEGER + 1
    if (mode === 'wrong-scope') snapshot.scope += 'extra'
    if (mode === 'partial') Object.assign(input[0].data, { current: null })
    if (mode === 'duplicate-card') input.push(input[0])
    expect(() => parsePendingCards(input)).toThrow('pending_read_failed')
  })
  it('uses observation age, including future timestamps, independently of the stored label', () => {
    const card = parsePendingCards(pendingFixture())[0]
    expect(isPendingStale(card, Date.parse('2026-10-26T11:00:00Z'))).toBe(false)
    expect(isPendingStale(card, Date.parse('2026-10-28T11:00:00Z'))).toBe(true)
    expect(isPendingStale(card, Date.parse('2026-10-25T11:00:00Z'))).toBe(true)
  })
})
