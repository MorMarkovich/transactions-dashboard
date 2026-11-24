import { expect, test, type Page } from '@playwright/test'

const user = {
  id: '00000000-0000-4000-8000-000000000004',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'dashboard@example.invalid',
  app_metadata: {},
  user_metadata: {},
  created_at: '2025-01-01T00:00:00Z',
}

const months = [
  { month: '06/2025', amount: 10210.5, income: 18500 },
  { month: '07/2025', amount: 11998.2, income: 18500 },
  { month: '08/2025', amount: 10750, income: 19500 },
  { month: '09/2025', amount: 11780, income: 19000 },
  { month: '10/2025', amount: 13725, income: 19000 },
]

const expenses = [
  { name: 'הוצאות שוטפות', expenses: 6811, income: 0 },
  { name: 'אוכל', expenses: 2600, income: 0 },
  { name: 'טיסות ותיירות', expenses: 1600, income: 0 },
  { name: 'בילויים', expenses: 1100, income: 0 },
  { name: 'קניות', expenses: 890, income: 0 },
  { name: 'תרופות וטיפולים', expenses: 724, income: 0 },
]
const transaction = { id: 1, תאריך: '2025-10-10', תאריך_חיוב: '2025-10-21', תיאור: 'קנייה במכולת', קטגוריה: 'אוכל', סכום: -120 }

async function openOverview(page: Page, withPace = false) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const expiration = Math.floor(Date.now() / 1000) + 3600
  await page.addInitScript(session => {
    localStorage.setItem('sb-127-auth-token', JSON.stringify(session))
  }, {
    access_token: `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ exp: expiration, sub: user.id })}.c3ludGhldGlj`,
    refresh_token: 'synthetic-refresh', expires_at: expiration, expires_in: 3600, token_type: 'bearer', user,
  })
  await page.route('http://127.0.0.1:54321/**', route => route.fulfill({ json: new URL(route.request().url()).pathname === '/auth/v1/user' ? { user } : [] }))
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url())
    const month = url.searchParams.get('month') ?? ''
    const selected = months.find(item => item.month === month)
    const catalog = { categories: [], subcategories: { אוכל: [{ name: 'מכולת' }] } }
    switch (url.pathname) {
      case '/api/metrics':
        return route.fulfill({ json: { total_transactions: 105, total_income: 19000, total_expenses: 13725, average_transaction: 130, has_billing_date: true } })
      case '/api/owners':
        return route.fulfill({ json: ['מור', 'שלי'] })
      case '/api/categories':
        return route.fulfill({ json: expenses.map(item => item.name) })
      case '/api/categories/catalog':
        return route.fulfill({ json: catalog })
      case '/api/session/scope':
        return route.fulfill({ json: { session_id: 'overview-demo' } })
      case '/api/charts/v2/monthly':
        expect(url.searchParams.get('include_income')).toBe('true')
        return route.fulfill({ json: { months } })
      case '/api/charts/v2/month-overview': {
        const transactionBasis = url.searchParams.get('date_type') === 'transaction'
        const cumulative = month === '10/2025'
          ? [...Array(17).fill(transactionBasis ? 7100 : 7000), transactionBasis ? 8400 : 8300]
          : month === '09/2025' ? [...Array(17).fill(7600), transactionBasis ? 8750 : 8700, ...Array(12).fill(11780)]
            : month === '07/2025' ? [...Array(30).fill(11100), 11998.2]
              : month === '06/2025' ? Array(30).fill(10210.5) : null
        return route.fulfill({ json: {
          month, total_expenses: selected?.amount ?? 0, total_income: selected?.income ?? 0,
          transaction_count: selected ? 105 : 0,
          categories: !selected ? [] : month === '10/2025' ? expenses : [{ name: 'אוכל', expenses: selected.amount, income: 0 }],
          ...(withPace ? { cumulative_expenses: cumulative } : {}),
        } })
      }
      case '/api/charts/v2/category-snapshot':
        return route.fulfill({ json: { categories: [], total: 0, total_count: 0, month_count: 0, last_month: null, prev_month: null } })
      case '/api/charts/v2/category-transactions':
        return route.fulfill({ json: { transactions: [transaction], total: 120, count: 1 } })
      case '/api/transactions':
        return route.fulfill({ json: { transactions: [transaction], total: 1, total_expenses: 120, expense_count: 1, median_transaction: 120 } })
      case '/api/income-analysis': {
        const salary = { name: 'משכורת לדוגמה', value: 19000, count: 1 }
        return route.fulfill({ json: {
          total: 19000, count: 1, average: 19000,
          sources: [salary], months: [{ ...salary, name: '10/2025' }], categories: [],
          transactions: [{ id: 3, date: '2025-10-01', source: salary.name, amount: salary.value, category: 'משכורת', account: 'חשבון דוגמה', notes: 'תלוש לדוגמה' }],
        } })
      }
      case '/api/export':
        return route.fulfill({ body: 'synthetic-download', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      default:
        return route.fulfill({ status: 503, json: {} })
    }
  })
  await page.goto('/?session_id=overview-demo')
  await expect(page.getByRole('heading', { name: 'סקירה פיננסית' })).toBeVisible()
}

test('dashboard months, category details and Excel stay on the selected reporting period', async ({ page }, testInfo) => {
  await openOverview(page)
  const overview = page.getByRole('region', { name: 'תמונת מצב חודשית' })
  await expect(overview.getByText(/13,725/)).toBeVisible()
  await expect(overview.getByText(/5,275/)).toBeVisible()
  const category = page.getByRole('region', { name: 'לאן הלך הכסף?' })
  await category.getByRole('button', { name: /כל 6 הקטגוריות/ }).click()
  await expect(category.getByRole('button', { name: /תרופות וטיפולים/ })).toBeVisible()

  await testInfo.attach('overview', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

  const detail = page.waitForRequest(request => new URL(request.url()).pathname === '/api/charts/v2/category-transactions')
  await category.getByRole('button', { name: /אוכל/ }).click()
  const detailParams = new URL((await detail).url()).searchParams
  expect(detailParams.get('month')).toBe('10/2025')
  await expect(page.getByText('קנייה במכולת').first()).toBeVisible()
  await page.keyboard.press('Escape')

  const activity = page.getByRole('group', { name: 'בחירת חודש בתרשים' })
  await activity.getByRole('button', { name: /ספטמבר 2025/ }).click()
  await expect(activity.getByRole('button', { name: /ספטמבר 2025/ })).toHaveAttribute('aria-pressed', 'true')
  await expect(overview.getByText(/11,780/)).toBeVisible()

  await page.getByText('סינון תצוגה', { exact: true }).click()
  await page.getByRole('button', { name: 'תאריך עסקה', exact: true }).click()
  await expect(overview.getByText(/11,780/)).toBeVisible()
  await overview.getByRole('button', { name: 'עסקאות החודש וייצוא' }).click()

  await expect(page).toHaveURL(/\/transactions\?/)
  const ledgerUrl = new URL(page.url())
  expect(ledgerUrl.pathname).toBe('/transactions')
  expect(ledgerUrl.searchParams.get('month')).toBe('09/2025')
  expect(ledgerUrl.searchParams.get('date_type')).toBe('transaction')
  await expect(page.getByRole('heading', { name: 'עסקאות', exact: true })).toBeVisible()
  await expect(page.locator('.active-filter-banner').getByText('ספטמבר 2025', { exact: true })).toBeVisible()

  const exportRequest = page.waitForRequest(request => new URL(request.url()).pathname === '/api/export')
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'ייצוא לאקסל' }).click()
  const exportParams = new URL((await exportRequest).url()).searchParams
  expect(exportParams.get('month')).toBe('09/2025')
  expect(exportParams.get('date_type')).toBe('transaction')
  expect((await download).suggestedFilename()).toBe('transactions.xlsx')
  await page.getByRole('button', { name: 'הצגת כל החודשים' }).click()
  await expect(page).toHaveURL(url => !url.searchParams.has('month'))
})

test('the dashboard fits a narrow RTL viewport in both colour schemes', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await openOverview(page)
  await expect(page.getByRole('region', { name: 'תמונת מצב חודשית' }).getByText(/13,725/)).toBeVisible()
  const noHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
  expect(await noHorizontalScroll()).toBe(true)
  await testInfo.attach('overview-320-dark', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  await page.getByRole('button', { name: 'מעבר למצב בהיר' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  expect(await noHorizontalScroll()).toBe(true)
  await testInfo.attach('overview-320-light', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
})

test('workspace search, navigation and income details keep the signed-in context', async ({ page }, testInfo) => {
  await openOverview(page)
  const search = page.getByRole('button', { name: 'חיפוש', exact: true })
  await expect(search).toHaveCount(1)
  await search.focus()
  await search.click()
  const finder = page.getByRole('dialog', { name: 'חיפוש עמוד או פעולה' })
  const searchInput = finder.getByRole('textbox')
  await expect(searchInput).toBeFocused()
  await searchInput.press('Escape')
  await expect(finder).toBeHidden()
  await expect(search).toBeFocused()
  await search.click()
  await searchInput.fill('הכנסות')
  await searchInput.press('Enter')
  await expect(page).toHaveURL(/\/income\?session_id=overview-demo$/)
  await expect(page.getByRole('heading', { name: 'כל ההכנסות (1)' })).toBeVisible()

  const detail = page.getByRole('button', { name: /פרטי הכנסה: משכורת לדוגמה/ })
  await detail.focus()
  await detail.press('Enter')
  await expect(detail).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByText('תלוש לדוגמה')).toBeVisible()
  await detail.press('Space')
  await expect(detail).toHaveAttribute('aria-expanded', 'false')
  await expect(page.getByText('תלוש לדוגמה')).toBeHidden()

  const desktop = testInfo.project.name === 'desktop-1280'
  if (!desktop) {
    await page.getByRole('navigation', { name: 'ניווט מהיר' }).getByRole('button', { name: 'פתח תפריט' }).click()
  }
  const nav = page.getByRole('navigation', { name: 'ניווט בסביבת העבודה' })
  await expect(nav.getByRole('link', { name: 'הכנסות' })).toHaveAttribute('aria-current', 'page')
  await nav.getByRole('link', { name: 'עסקאות' }).click()
  await expect(page).toHaveURL(/\/transactions\?session_id=overview-demo$/)
  const ledger = page.getByText('קנייה במכולת', { exact: true }).filter({ visible: true })
  const analysis = page.getByText('סיכום וניתוח לפי קטגוריה', { exact: true })
  await expect(ledger).toBeVisible()
  await expect(analysis).toBeVisible()
  expect(await ledger.evaluate(element => {
    const summary = document.querySelector('.tx-analysis > summary')
    return Boolean(summary
      && (element.compareDocumentPosition(summary) & Node.DOCUMENT_POSITION_FOLLOWING)
      && element.getBoundingClientRect().bottom <= summary.getBoundingClientRect().top)
  })).toBe(true)
  await analysis.click()
  const median = page.locator('.workspace-metric').filter({ hasText: 'חציון הוצאה' })
  await expect(median).toContainText('120.00')
  await expect(page.getByRole('button', { name: 'ייצוא לאקסל' })).toBeEnabled()

  if (desktop) {
    await search.click()
    await expect(searchInput).toBeFocused()
    await page.setViewportSize({ width: 800, height: 800 })
    await expect(page.locator('.workspace-search')).toHaveCount(0)
    await searchInput.press('Escape')
    await expect(page.getByRole('main')).toBeFocused()
  }
})

test('spending pace compares equal days and keeps future charges separate', async ({ page, hasTouch }, testInfo) => {
  await page.clock.setFixedTime(new Date('2025-10-18T10:00:00Z'))
  await openOverview(page, true)

  const pace = page.getByRole('region', { name: 'קצב ההוצאות' })
  const slider = pace.getByRole('slider', { name: 'יום להשוואת ההוצאות' })
  await expect(slider).toHaveValue('18')
  await expect(pace.getByText(/8,300\.00/)).toBeVisible()
  await expect(pace.getByText(/8,700\.00/)).toBeVisible()
  await expect(pace.getByText(/400\.00.*פחות/)).toBeVisible()
  await expect(page.getByText('כולל חיובים עתידיים')).toBeVisible()
  await expect(page.getByText(/5,425\.00.*שתאריכן בהמשך/)).toBeVisible()
  await expect(page.locator('.finance-income-share')).toContainText('72.2%')
  await expect(pace.locator('.recharts-area-curve')).toBeVisible()
  await expect(pace.locator('.recharts-line-curve')).toBeVisible()
  const guide = pace.locator('.recharts-reference-line-line')
  const startingGuide = await guide.getAttribute('x1')

  await slider.press('ArrowLeft')
  await expect(slider).toHaveValue('17')
  await expect(slider).toHaveAttribute('aria-valuetext', /יום 17.*7,000\.00.*7,600\.00/)
  await expect(pace.getByText(/600\.00.*פחות/)).toBeVisible()
  await expect(guide).not.toHaveAttribute('x1', startingGuide ?? '')
  if (hasTouch) {
    const width = await slider.evaluate(element => element.clientWidth)
    await slider.tap({ position: { x: width / 4, y: 15 } })
    expect(Number(await slider.inputValue())).toBeLessThan(17)
  }

  await page.getByText('סינון תצוגה', { exact: true }).click()
  await page.getByRole('button', { name: 'תאריך עסקה', exact: true }).click()
  await expect(slider).toHaveValue('18')
  await expect(pace.getByText(/8,400\.00/)).toBeVisible()
  await expect(pace.getByText(/8,750\.00/)).toBeVisible()
  await expect(pace.getByText(/350\.00.*פחות/)).toBeVisible()

  await page.getByText('מה השתנה בין סיכומי החודשים?', { exact: true }).click()
  const fullMonth = page.locator('.finance-period-changes')
  await expect(fullMonth.getByText(/1,945\.00/)).toBeVisible()
  await fullMonth.getByRole('button', { name: /הוצאות שוטפות/ }).click()
  await expect(page.getByText('קנייה במכולת').first()).toBeVisible()
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'חודש קודם עם נתונים' }).click()
  await expect(slider).toHaveValue('30')
  await expect(pace.getByText(/11,780\.00/)).toBeVisible()
  await expect(pace.getByText('אין נתוני השוואה לחודש הקודם.')).toBeVisible()

  await page.getByRole('group', { name: 'בחירת חודש בתרשים' }).getByRole('button', { name: /יולי 2025/ }).click()
  await expect(slider).toHaveValue('30')
  await expect(pace.getByText(/10,210\.50/)).toBeVisible()
  await slider.press('ArrowRight')
  await expect(slider).toHaveValue('31')
  await expect(pace.getByText('יוני 2025', { exact: true })).toBeVisible()
  await expect(pace.getByText('החודש הקודם הסתיים לפני היום הזה.')).toBeVisible()

  await page.setViewportSize({ width: 320, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  for (const theme of ['dark', 'light']) {
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    await testInfo.attach(`spending-pace-${theme}`, { body: await pace.screenshot(), contentType: 'image/png' })
    if (theme === 'dark') await page.getByRole('banner').getByRole('button', { name: 'מעבר למצב בהיר' }).click()
  }
})
