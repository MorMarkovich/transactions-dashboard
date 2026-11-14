import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { migrateUserState } from './userStorage'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null; needsConfirmation?: boolean }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
  updatePassword: (newPassword: string) => Promise<{ error: string | null }>
  updateEmail: (newEmail: string) => Promise<{ error: string | null }>
  updateDisplayName: (name: string) => Promise<{ error: string | null }>
}

// Maps Supabase auth errors to Hebrew. Raw server messages (English) must
// never reach the UI: unrecognized errors get a generic Hebrew message that
// does not guess at the cause.
export function authErrorMessage(error: { message?: string } | null): string | null {
  if (!error) return null
  const m = (error.message || '').toLowerCase()
  if (m.includes('not confirmed')) return 'יש לאשר את כתובת המייל (הקישור נשלח אליכם) לפני ההתחברות'
  if (m.includes('unable to validate email') || m.includes('invalid format') || m.includes('valid email')) return 'כתובת המייל אינה תקינה'
  if (m.includes('rate limit') || m.includes('rate_limit') || m.includes('too many') || m.includes('for security purposes')) return 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות'
  if (m.includes('already')) return 'המייל כבר רשום'
  if (m.includes('invalid')) return 'מייל או סיסמה שגויים'
  if (m.includes('different from the old')) return 'הסיסמה החדשה חייבת להיות שונה מהנוכחית'
  if (m.includes('password')) return 'הסיסמה אינה עומדת בדרישות (לפחות 6 תווים)'
  return 'משהו השתבש. נסו שוב מאוחר יותר'
}

// Exported so state-only consumers (e.g. FilterProvider) can tolerate a
// missing provider in tests via useContext; useAuth keeps the hard guard.
export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      // Migrate legacy global view state into this user's scoped keys BEFORE
      // publishing the user, so consumers never read pre-migration storage.
      if (session?.user) migrateUserState(session.user.id)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) migrateUserState(session.user.id)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: authErrorMessage(error) }
  }

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name }, emailRedirectTo: window.location.origin }
    })
    if (error) return { error: authErrorMessage(error) }
    // With "Confirm email" enabled Supabase returns the user but no session,
    // and for an already-registered address an obfuscated user with no
    // identities. With it disabled a session comes back and the user is
    // signed straight in. Handle all three.
    if (!data.session && data.user && (data.user.identities?.length ?? 1) === 0) {
      return { error: 'המייל כבר רשום' }
    }
    return { error: null, needsConfirmation: !data.session }
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  const resetPassword = async (email: string) => {
    // The recovery email must land on the dedicated reset page of THIS
    // deployment (also allow-listed in Supabase Auth redirect URLs).
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: authErrorMessage(error) }
  }

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    return { error: authErrorMessage(error) }
  }

  const updateEmail = async (newEmail: string) => {
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    return { error: authErrorMessage(error) }
  }

  const updateDisplayName = async (name: string) => {
    const { error } = await supabase.auth.updateUser({ data: { full_name: name } })
    return { error: authErrorMessage(error) }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, resetPassword, updatePassword, updateEmail, updateDisplayName }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
