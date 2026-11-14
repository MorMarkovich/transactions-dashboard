import { expect, test, type Page } from '@playwright/test'

const callback = 'http://127.0.0.1:4173/auth/callback'
const userId = '00000000-0000-4000-8000-000000000003'
const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'example@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-11-01T00:00:00Z' }

async function mockProvider(page: Page, provider: 'apple' | 'google', result: 'success' | 'cancel' | 'expired') {
  const exchange = { count: 0 }
  await page.route('http://127.0.0.1:54321/**', async (route) => {
    const url = new URL(route.request().url())
    const headers = {
      'access-control-allow-origin': 'http://127.0.0.1:4173',
      'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info, x-supabase-api-version',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
    }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers })
    if (url.pathname === '/auth/v1/settings') return route.fulfill({ headers, json: { external: { apple: true, google: true } } })
    if (url.pathname === '/auth/v1/authorize') {
      expect(url.searchParams.get('provider')).toBe(provider)
      expect(url.searchParams.get('redirect_to')).toBe(callback)
      expect(url.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/)
      expect(url.searchParams.get('code_challenge_method')).toBe('s256')
      expect(url.searchParams.get('scopes')).toBeNull()
      const destination = result === 'cancel' ? `${callback}#error=access_denied&error_description=raw-provider-message` : `${callback}?code=synthetic-one-time-code`
      return route.fulfill({ contentType: 'text/html', body: `<script>location.replace(${JSON.stringify(destination)})</script>` })
    }
    if (url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'pkce') {
      exchange.count++
      expect(route.request().postDataJSON()).toMatchObject({ auth_code: 'synthetic-one-time-code', code_verifier: expect.stringMatching(/^.{43,128}$/) })
      if (result === 'expired') return route.fulfill({ status: 400, headers, json: { error_code:'flow_state_expired', msg:'raw-provider-message' } })
      const encoded = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
      const accessToken = `${encoded({ alg: 'HS256', typ: 'JWT' })}.${encoded({ exp: Math.floor(Date.now() / 1000) + 3600, sub: userId })}.c3ludGhldGlj`
      return route.fulfill({ headers, json: { access_token: accessToken, refresh_token: 'synthetic-refresh', token_type: 'bearer', expires_in: 3600, user } })
    }
    if (url.pathname === '/auth/v1/user') return route.fulfill({ headers, json: user })
    if (url.pathname.startsWith('/rest/v1/')) return route.fulfill({ headers, json: [] })
    return route.abort()
  })
  return exchange
}

test('Google returns to the requested protected page after a single PKCE exchange', async ({ page }) => {
  const exchange = await mockProvider(page, 'google', 'success')
  await page.goto('/transactions?search=coffee')
  await page.getByRole('button', { name: 'המשיכו עם Google' }).click()
  await expect(page).toHaveURL(/\/transactions\?search=coffee$/)
  expect(exchange.count).toBe(1)
  expect(await page.evaluate(() => sessionStorage.getItem('pinkas-social-login'))).toBeNull()
})

test('Apple registration opens the new-user dashboard after provider consent', async ({ page }) => {
  const exchange = await mockProvider(page, 'apple', 'success')
  await page.goto('/login?mode=register')
  await page.getByRole('button', { name: 'המשיכו עם Apple' }).click()
  await expect(page).toHaveURL('http://127.0.0.1:4173/')
  await expect(page.getByRole('heading', { name: 'הסקירה שלכם מתחילה כאן.' })).toBeVisible()
  expect(exchange.count).toBe(1)
})

test('Apple cancellation returns to registration with a clean URL and no exchange', async ({ page }) => {
  const exchange = await mockProvider(page, 'apple', 'cancel')
  await page.goto('/login?mode=register')
  await page.getByRole('button', { name: 'המשיכו עם Apple' }).click()
  await expect(page).toHaveURL(/\/login\?mode=register$/)
  await expect(page.getByRole('alert')).toHaveText('ההתחברות בוטלה. אפשר לנסות שוב.')
  await expect(page.getByRole('button', { name: 'המשיכו עם Apple' })).toBeEnabled()
  expect(exchange.count).toBe(0)
})

test('an expired code restores the login form and does not reveal provider details', async ({ page }) => {
  const exchange = await mockProvider(page, 'apple', 'expired')
  await page.goto('/login')
  await page.getByRole('button', { name: 'המשיכו עם Apple' }).click()
  await expect(page.getByRole('alert')).toHaveText(/לא הצלחנו להשלים את ההתחברות/)
  await expect(page.getByText('raw-provider-message')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'התחבר', exact: true })).toBeEnabled()
  expect(exchange.count).toBe(1)
})

test('an unconfigured provider leaves email sign-in available', async ({ page }) => {
  await page.route('**/auth/v1/settings', route => {
    const headers = {
      'access-control-allow-origin': 'http://127.0.0.1:4173',
      'access-control-allow-headers': 'apikey',
      'access-control-allow-methods': 'GET, OPTIONS',
    }
    return route.request().method() === 'OPTIONS'
      ? route.fulfill({ status: 204, headers })
      : route.fulfill({ headers, json: { external: { apple: false } } })
  })
  await page.goto('/login')
  const button = page.getByRole('button', { name: 'המשיכו עם Apple' })
  await button.focus()
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toHaveText(/התחברות עם Apple עדיין לא זמינה/)
  await expect(page.getByRole('button', { name: 'התחבר', exact: true })).toBeEnabled()
  await expect(page).toHaveURL(/\/login$/)
})

test('an OAuth callback without a local attempt fails without a token request', async ({ page }) => {
  const exchange = await mockProvider(page, 'google', 'success')
  await page.goto('/auth/callback?code=missing-verifier')
  await expect(page.getByRole('alert')).toHaveText(/לא הצלחנו להשלים את ההתחברות/)
  await expect(page).toHaveURL(/\/login$/)
  expect(exchange.count).toBe(0)
})
