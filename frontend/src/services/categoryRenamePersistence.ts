import { supabaseApi } from './supabaseApi'

/**
 * Persist a category rename so it survives the next restore. Every step is
 * idempotent and any failure THROWS: the rename endpoints are retry-safe
 * (backend rename is idempotent once applied), so a caller that shows the
 * error and lets the user retry will drive a half-finished rename to
 * completion instead of leaving rules/pins pointing at the old name.
 *
 * Steps: re-point merchant rules in place (subcategory + source preserved),
 * migrate single-transaction pins, register a brand-new custom category, and
 * rename an existing custom-category row.
 */
export async function persistCategoryRenameToSupabase(
  userId: string,
  oldCategory: string,
  newCategory: string,
  merchants: string[],
  opts: { newIsCustom: boolean; oldIsCustom: boolean },
): Promise<void> {
  if (merchants.length > 0) {
    await supabaseApi.renameCategoryRules(userId, merchants, newCategory)
  }
  await supabaseApi.renameTransactionOverrideCategory(userId, oldCategory, newCategory)
  if (opts.newIsCustom) {
    await supabaseApi.upsertUserCategory(userId, newCategory)
  }
  if (opts.oldIsCustom) {
    await supabaseApi.renameUserCategory(userId, oldCategory, newCategory)
  }
}
