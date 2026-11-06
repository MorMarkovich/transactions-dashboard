export function useAuth() {
  return { user: { id: 'audit-user-1' }, loading: false }
}
export function AuthProvider({ children }: { children: React.ReactNode }) { return <>{children}</> }
