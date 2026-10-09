import { test, expect, type Page } from '@playwright/test'

// Regression: the shared Input forced email fields LTR (icon and placeholder on
// the left) while password fields were RTL. Every auth field must be RTL with
// the icon on the right, on every auth surface, desktop and 390.

interface Surface {
  name: string
  open: (page: Page) => Promise<void>
  inputs: number
}

const surfaces: Surface[] = [
  { name: 'login', inputs: 2, open: async () => {} },
  {
    name: 'register',
    inputs: 4,
    open: async (page) => { await page.getByRole('button', { name: 'צור חשבון חדש' }).click() },
  },
  {
    name: 'forgot-password',
    inputs: 1,
    open: async (page) => { await page.getByRole('button', { name: 'שכחתי סיסמה' }).click() },
  },
]

for (const surface of surfaces) {
  test(`${surface.name}: every field is RTL with its icon on the right`, async ({ page }, testInfo) => {
    await page.goto('/login')
    await expect(page.locator('form')).toBeVisible()
    await surface.open(page)

    const inputs = page.locator('form input:visible')
    await expect(inputs).toHaveCount(surface.inputs)

    const rows = await inputs.evaluateAll((els) =>
      els.map((el) => {
        const input = el as HTMLInputElement
        const cs = getComputedStyle(input)
        const box = input.getBoundingClientRect()
        const icon = input.parentElement?.querySelector('svg')?.getBoundingClientRect()
        return {
          label: input.getAttribute('aria-label') || input.placeholder || input.type,
          direction: cs.direction,
          textAlign: cs.textAlign,
          inputCenter: box.left + box.width / 2,
          iconCenter: icon ? icon.left + icon.width / 2 : null,
        }
      }),
    )

    for (const r of rows) {
      expect(r.direction, `${r.label} direction`).toBe('rtl')
      expect(['right', 'start'], `${r.label} text-align`).toContain(r.textAlign)
      if (r.iconCenter !== null) {
        expect(r.iconCenter, `${r.label} icon must sit in the right half`).toBeGreaterThan(r.inputCenter)
      }
    }

    // No clipping or horizontal scroll on the page.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow, 'horizontal overflow').toBe(false)

    await testInfo.attach(`${surface.name}-${testInfo.project.name}`, {
      body: await page.screenshot(),
      contentType: 'image/png',
    })
  })
}

test('login page carries the product name', async ({ page }) => {
  await page.goto('/login')
  await expect(page).toHaveTitle(/פנקס/)
  await expect(page.getByText('פנקס', { exact: true }).locator('visible=true').first()).toBeVisible()
})
