import { describe, it, expect, vi, beforeEach } from 'vitest'
import { guardSampleWrites, markSampleSession, clearSampleSession, isSampleActive } from './sampleMode'
import { buildSampleTransactions } from './sampleData'

describe('sample mode', () => {
  beforeEach(() => {
    clearSampleSession()
    window.history.pushState({}, '', '/')
  })

  it('is inactive until a sample session is marked', () => {
    expect(isSampleActive()).toBe(false)
    markSampleSession('abc')
    expect(isSampleActive()).toBe(true)
  })

  it('is inactive when the URL carries a different (real) session', () => {
    markSampleSession('abc')
    window.history.pushState({}, '', '/?session_id=real-1')
    expect(isSampleActive()).toBe(false)
    window.history.pushState({}, '', '/transactions?session_id=abc')
    expect(isSampleActive()).toBe(true)
  })

  it('skips every write-type call while active and passes reads through', async () => {
    const api = {
      getCategoryRules: vi.fn().mockResolvedValue(['r']),
      upsertCategoryRule: vi.fn().mockResolvedValue('w'),
      upsertCategoryRules: vi.fn().mockResolvedValue('w'),
      upsertTransactionOverride: vi.fn().mockResolvedValue('w'),
      upsertTransactionNote: vi.fn().mockResolvedValue('w'),
      saveTransactions: vi.fn().mockResolvedValue('w'),
      deleteAllTransactions: vi.fn().mockResolvedValue('w'),
      addIncome: vi.fn().mockResolvedValue('w'),
      updateUserSettings: vi.fn().mockResolvedValue('w'),
    }
    const g = guardSampleWrites(api)
    markSampleSession('abc')
    await Promise.all([
      g.upsertCategoryRule(), g.upsertCategoryRules(), g.upsertTransactionOverride(),
      g.upsertTransactionNote(), g.saveTransactions(), g.deleteAllTransactions(),
      g.addIncome(), g.updateUserSettings(),
    ])
    expect(await g.getCategoryRules()).toEqual(['r'])
    for (const [name, fn] of Object.entries(api)) {
      if (name !== 'getCategoryRules') expect(fn, name).not.toHaveBeenCalled()
    }
    clearSampleSession()
    await g.upsertCategoryRule()
    expect(api.upsertCategoryRule).toHaveBeenCalledTimes(1)
  })
})

describe('sample data', () => {
  it('has income and expenses, valid dates and no duplicate rows', () => {
    const rows = buildSampleTransactions(new Date(2026, 9, 9))
    expect(rows.length).toBeGreaterThan(80)
    expect(rows.some((r) => (r['סכום'] as number) > 0)).toBe(true)
    expect(rows.some((r) => (r['סכום'] as number) < 0)).toBe(true)
    expect(rows.every((r) => (r['תאריך'] as string) <= '2026-10-09')).toBe(true)
    const keys = new Set(rows.map((r) => `${r['תאריך']}|${r['סכום']}|${r['תיאור']}`))
    expect(keys.size).toBe(rows.length)
  })

  it('is deterministic', () => {
    const d = new Date(2026, 9, 9)
    expect(buildSampleTransactions(d)).toEqual(buildSampleTransactions(d))
  })
})
