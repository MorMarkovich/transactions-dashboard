// Post-login redirect target carried through the auth guard. Only same-origin
// relative paths are honored:
// - no absolute URLs, no protocol-relative "//host" — including after
//   percent-decoding (%2F%2Fhost) or backslash tricks ("/\host", "%5C"),
//   which URL parsers can normalize into a protocol-relative URL;
// - no loops back into the auth pages;
// - the URL hash is never carried (Supabase places tokens there during
//   recovery).
export function safeReturnTo(raw: unknown): string {
  if (typeof raw !== 'string' || raw.length === 0) return '/'
  if (raw.includes('\\')) return '/'
  let decoded = raw
  try {
    decoded = decodeURIComponent(raw)
  } catch {
    return '/' // malformed percent-encoding — not a path we can vouch for
  }
  if (decoded.includes('\\') || decoded.includes('//')) return '/'
  if (!decoded.startsWith('/')) return '/'
  const base = 'https://pinkas.invalid'
  let parsed: URL
  try { parsed = new URL(decoded, base) } catch { return '/' }
  if (parsed.origin !== base) return '/'
  const normalizedPath = parsed.pathname.replace(/\/$/, '').toLowerCase()
  if (['/login', '/reset-password', '/auth/callback'].includes(normalizedPath)) return '/'
  return raw.split('#', 1)[0]
}
