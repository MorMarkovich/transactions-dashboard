import { merchantRuleKey } from '../services/categoryRuleStore'
import type { Transaction } from '../services/types'

// A bare payment channel doesn't identify a merchant or the purpose of a transfer.
export function isGenericBitTransaction({ תיאור }: Transaction): boolean {
  const description = merchantRuleKey(תיאור)
  return /^(?:(?:bit(?:pay)?|ביט)(?:[\s:–-]+(?:payment|transfer|העברה|העברת כספים|תשלום))?|(?:תשלום|העברה|העברת כספים)\s+(?:ב[\s-]*)?(?:bit(?:pay)?|ביט))$/i.test(description)
}
