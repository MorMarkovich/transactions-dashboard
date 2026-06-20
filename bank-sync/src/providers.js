// Provider constants — no side effects, safe to import anywhere.

export const SUPPORTED = ['leumi', 'discount', 'max', 'isracard']

// Bank (עו"ש) accounts vs credit cards. Used to set the `_is_bank_row` marker
// the dashboard's restore step relies on to strip lump-sum card payments.
export const BANK_PROVIDERS = ['leumi', 'discount']
export const CARD_PROVIDERS = ['max', 'isracard']

export const PROVIDER_LABELS = {
  leumi: 'בנק לאומי',
  discount: 'בנק דיסקונט',
  max: 'MAX (לאומי קארד)',
  isracard: 'ישראכרט',
}

// Credential fields per provider, matching israeli-bank-scrapers login shapes.
// `secret: true` fields are masked during setup; all are stored in the OS keychain.
export const PROVIDER_FIELDS = {
  leumi: [
    { key: 'username', label: 'שם משתמש', secret: false },
    { key: 'password', label: 'סיסמה', secret: true },
  ],
  discount: [
    { key: 'id', label: 'תעודת זהות', secret: false },
    { key: 'password', label: 'סיסמה', secret: true },
    { key: 'num', label: 'קוד בן 6 ספרות', secret: true },
  ],
  max: [
    { key: 'username', label: 'שם משתמש', secret: false },
    { key: 'password', label: 'סיסמה', secret: true },
  ],
  isracard: [
    { key: 'id', label: 'תעודת זהות', secret: false },
    { key: 'card6Digits', label: '6 ספרות אחרונות של הכרטיס', secret: false },
    { key: 'password', label: 'סיסמה', secret: true },
  ],
}

export const isBankProvider = (p) => BANK_PROVIDERS.includes(p)
export const isCardProvider = (p) => CARD_PROVIDERS.includes(p)
