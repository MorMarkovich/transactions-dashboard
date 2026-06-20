// Owner attribution. Each account has a default owner (its cardholder). A
// JOINT account (owner 'משותף') holds both people's salaries and shared
// spending, so its rows are attributed by name/keyword where possible.

export const JOINT = 'משותף'

// Seeded from the salaries we've seen; fully overridable via OWNER_KEYWORDS.
// Keyword match (case-insensitive substring) on the description.
export const DEFAULT_OWNER_KEYWORDS = {
  'מור': ['מור', 'mor', 'בנק פועלים משכורת'],
  'שלי': ['שלי', 'shelly', 'ישראכרט מש משכורת'],
}

/**
 * Decide the owner of a transaction.
 *  - Personal account (owner set and not JOINT) → that owner, always.
 *  - Joint account → match a person's keyword in the description, else JOINT.
 */
export function detectOwner(description, accountOwner, ownerKeywords = DEFAULT_OWNER_KEYWORDS) {
  if (accountOwner && accountOwner !== JOINT) return accountOwner
  const desc = String(description || '').toLowerCase()
  for (const [owner, kws] of Object.entries(ownerKeywords || {})) {
    if ((kws || []).some((k) => desc.includes(String(k).toLowerCase()))) return owner
  }
  return JOINT
}

// Parse OWNER_KEYWORDS env (JSON like {"מור":["mor"],"שלי":["shelly"]}).
export function parseOwnerKeywords(raw) {
  if (!raw) return DEFAULT_OWNER_KEYWORDS
  try {
    const obj = JSON.parse(raw)
    return obj && typeof obj === 'object' ? obj : DEFAULT_OWNER_KEYWORDS
  } catch {
    return DEFAULT_OWNER_KEYWORDS
  }
}
