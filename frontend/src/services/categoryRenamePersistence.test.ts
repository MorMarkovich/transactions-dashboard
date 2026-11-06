import { expect, it, vi, beforeEach } from 'vitest'

vi.mock('./supabaseApi', () => ({
  supabaseApi: {
    renameCategoryRules: vi.fn(),
    renameTransactionOverrideCategory: vi.fn(),
    upsertUserCategory: vi.fn(),
    renameUserCategory: vi.fn(),
  },
}))

import { supabaseApi } from './supabaseApi'
import { persistCategoryRenameToSupabase } from './categoryRenamePersistence'

const api = supabaseApi as unknown as Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset().mockResolvedValue(undefined)
})

it('runs the full chain for a rename to a new custom name', async () => {
  await persistCategoryRenameToSupabase('u1', 'אוכל', 'מזון חדש', ['m1', 'm2'], { newIsCustom: true, oldIsCustom: false })
  expect(api.renameCategoryRules).toHaveBeenCalledWith('u1', ['m1', 'm2'], 'מזון חדש')
  expect(api.renameTransactionOverrideCategory).toHaveBeenCalledWith('u1', 'אוכל', 'מזון חדש')
  expect(api.upsertUserCategory).toHaveBeenCalledWith('u1', 'מזון חדש')
  expect(api.renameUserCategory).not.toHaveBeenCalled()
})

it('mid-chain failure throws and the idempotent retry completes the remaining steps', async () => {
  // Attempt 1: rules renamed, then the pin migration fails (network).
  api.renameTransactionOverrideCategory.mockRejectedValueOnce(new Error('network'))
  await expect(
    persistCategoryRenameToSupabase('u1', 'אוכל', 'בילויים', ['m1'], { newIsCustom: false, oldIsCustom: true }),
  ).rejects.toThrow('network')
  // user_categories registration never ran in attempt 1 — but the OLD name was
  // custom, so the rename of that row is still pending too.
  expect(api.renameUserCategory).not.toHaveBeenCalled()

  // Attempt 2 (retry): every step runs again; all are idempotent.
  await persistCategoryRenameToSupabase('u1', 'אוכל', 'בילויים', ['m1'], { newIsCustom: false, oldIsCustom: true })
  expect(api.renameCategoryRules).toHaveBeenCalledTimes(2)
  expect(api.renameTransactionOverrideCategory).toHaveBeenCalledTimes(2)
  expect(api.renameUserCategory).toHaveBeenCalledWith('u1', 'אוכל', 'בילויים')
})

it('a failure registering the custom category also throws (retry completes it)', async () => {
  api.upsertUserCategory.mockRejectedValueOnce(new Error('rls'))
  await expect(
    persistCategoryRenameToSupabase('u1', 'אוכל', 'מזון חדש', ['m1'], { newIsCustom: true, oldIsCustom: false }),
  ).rejects.toThrow('rls')
  await persistCategoryRenameToSupabase('u1', 'אוכל', 'מזון חדש', ['m1'], { newIsCustom: true, oldIsCustom: false })
  expect(api.upsertUserCategory).toHaveBeenCalledTimes(2)
})
