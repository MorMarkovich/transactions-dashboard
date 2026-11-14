import { isGenericBitTransaction } from '../utils/bitTransactions'
import { isSampleActive } from '../lib/sampleMode'
import { ASSIGNABLE_CATEGORIES } from '../utils/constants'
import { transactionsApi } from './api'
import { supabaseApi } from './supabaseApi'
import type { Transaction } from './types'

export interface ClassificationEdit {
  category: string
  /** null lets the server derive the subcategory; a blank string clears it. */
  subcategory: string | null
  onlyThis: boolean
}

export interface TransactionEditorChanges {
  classification?: ClassificationEdit
  note?: string
}

export const CLASSIFICATION_PERSISTENCE_WARNING = 'הסיווג עודכן בתצוגה, אך השמירה לשימוש עתידי נכשלה.'

export async function saveClassification(
  sessionId: string,
  userId: string | undefined,
  transactions: Transaction[],
  { category, subcategory, onlyThis }: ClassificationEdit,
) {
  const ids = transactions.flatMap(tx => typeof tx.id === 'number' ? [tx.id] : [])
  const single = onlyThis || transactions.some(isGenericBitTransaction)
  const result = await transactionsApi.bulkUpdateCategory(sessionId, ids, category, subcategory, single)
  const locked = result.locked ?? single

  let persistenceFailed = false
  if (userId && !isSampleActive()) {
    try {
      if (!ASSIGNABLE_CATEGORIES.includes(category)) {
        await supabaseApi.upsertUserCategory(userId, category)
      }
      if (locked) {
        await Promise.all(result.items.map(item =>
          supabaseApi.upsertTransactionOverride(userId, item.txn_key, category, item.subcategory || null),
        ))
      } else {
        const merchants = new Map(result.items.filter(item => item.merchant).map(item => [item.merchant, item]))
        await supabaseApi.upsertCategoryRules(userId, [...merchants.values()].map(item => ({
          merchant: item.merchant, category, subcategory: item.subcategory,
        })))
        await Promise.all(result.items.map(item => supabaseApi.deleteTransactionOverride(userId, item.txn_key)))
      }
    } catch (error) {
      console.warn('Could not persist transaction classification', error)
      persistenceFailed = true
    }
  }

  const byId = new Map(result.items.map(item => [item.id, item]))
  return {
    persistenceFailed,
    updated: transactions.flatMap(tx => {
      const item = tx.id == null ? undefined : byId.get(tx.id)
      if (!item) return []
      return [{ ...tx, קטגוריה: result.category, קטגוריה_משנה: item.subcategory, _locked: locked }]
    }),
  }
}

export async function saveTransactionNote(sessionId: string, userId: string | undefined, id: number, note: string) {
  const result = await transactionsApi.updateTransactionNote(sessionId, id, note)
  if (userId && !isSampleActive() && result.txn_key) {
    if (result.notes) await supabaseApi.upsertTransactionNote(userId, result.txn_key, result.notes)
    else await supabaseApi.deleteTransactionNote(userId, result.txn_key)
  }
  return result.notes ?? ''
}

export async function saveTransactionEdits(
  sessionId: string, userId: string | undefined, transaction: Transaction, { classification, note }: TransactionEditorChanges,
) {
  if (typeof transaction.id !== 'number') throw new Error('Transaction has no id')
  let updated = transaction
  const warnings: string[] = []
  if (classification) {
    const result = await saveClassification(sessionId, userId, [transaction], classification)
    updated = result.updated[0] ?? transaction
    if (result.persistenceFailed) warnings.push(CLASSIFICATION_PERSISTENCE_WARNING)
  }
  if (note !== undefined) {
    try {
      updated = { ...updated, הערות: await saveTransactionNote(sessionId, userId, transaction.id, note) }
    } catch {
      warnings.push('שמירת ההערה נכשלה. נסו שוב.')
    }
  }
  return { updated, warning: warnings.join(' ') || undefined }
}
