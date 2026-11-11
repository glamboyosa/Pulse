import { createServer } from 'node:http'
import { expect, test } from '@playwright/test'

import { customerWithVoice, db, signUpBusiness } from './support'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'

// A stand-in for a customer's website, served for real on localhost: Chrome
// only lets a page on the local network load the local dev server's script.
const serveSite = (page: () => string) =>
  new Promise<{ server: Server; origin: string }>((resolve, reject) => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(page())
    })
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ server, origin: `http://localhost:${port}` })
    })
  })

const noteId = async (code: string) =>
  (
    await db.query<{ id: string }>(
      `select f.id from feedback f join users u on u.id = f.user_id
       where u.unique_code = $1`,
      [code],
    )
  ).rows[0].id

test('a website shows the widget and a visitor leaves voice feedback with the page attached', async ({
  page,
  browser,
}, testInfo) => {
  const code = `e2e-widget-${Date.now()}`
  let snippet = ''
  const host = await serveSite(
    () => `<!doctype html><title>Billing</title><h1>Host app</h1>${snippet}
      <script>addEventListener('load', () => {
        Pulse.identify({ id: 'user-42' })
        Pulse.setContext({ appVersion: '3.1.0', plan: 'pro' })
      })</script>`,
  )
  try {
    await signUpBusiness(
      page,
      `${code}@example.test`,
      code,
      'On my website or app',
    )

    await test.step('the owner turns the widget on and lists the site', async () => {
      await page.goto('/settings')
      await page.getByRole('button', { name: 'Turn on the widget' }).click()
      await expect(page.locator('pre code')).toContainText('data-key="pk_')
      const sites = page.getByLabel(/Websites allowed to show it/)
      // A comma becomes a new line: one site per line.
      await sites.fill('a.example,')
      await expect(sites).toHaveValue('a.example\n')
      await sites.fill(host.origin)
      await page.getByRole('button', { name: 'Save websites' }).click()
      await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible()
    })
    snippet = await page.locator('pre code').innerText()

    await test.step('a visitor records a note through the widget', async () => {
      // The project's device (desktop or Pixel 7), so mobile gets the narrow layout.
      const { baseURL: _baseURL, ...device } = testInfo.project.use
      const visitor = await browser.newContext(device)
      const site = await customerWithVoice(visitor)
      await site.goto(`${host.origin}/billing?token=secret`)
      await site.getByRole('button', { name: 'Feedback', exact: true }).click()
      const widget = site.frameLocator('iframe[title="Leave feedback"]')
      await widget.getByRole('button', { name: 'START RECORDING' }).click()
      await site.waitForTimeout(6000)
      await widget.getByRole('button', { name: 'STOP' }).click()
      await widget.getByRole('button', { name: 'SEND FEEDBACK' }).click()
      // Sending uploads the recording to R2 first.
      await expect(widget.getByText('THANK YOU!')).toBeVisible({
        timeout: 20_000,
      })
      // Escape inside the widget closes it on the host page.
      await widget.getByText('THANK YOU!').press('Escape')
      await expect(
        site.getByRole('button', { name: 'Feedback', exact: true }),
      ).toHaveAttribute('aria-expanded', 'false')
      await visitor.close()
    })

    await test.step('the owner sees where the note was left', async () => {
      await page.goto('/dashboard')
      const tag = page.getByText('Website · /billing')
      await expect(tag).toBeVisible()
      await page.goto('/feedback/' + (await noteId(code)))
      await expect(
        page.getByRole('heading', { name: 'Left on your website' }),
      ).toBeVisible()
      await expect(page.getByText('3.1.0')).toBeVisible()
    })

    await test.step('it arrives as widget feedback with the page, not the token', async () => {
      const result = await db.query<{ channel: string; context: unknown }>(
        `select f.channel, f.context from feedback f
       join users u on u.id = f.user_id where u.unique_code = $1`,
        [code],
      )
      expect(result.rows).toHaveLength(1)
      expect(result.rows[0]).toMatchObject({
        channel: 'widget',
        context: {
          page: '/billing',
          title: 'Billing',
          appVersion: '3.1.0',
          userId: 'user-42',
          custom: { plan: 'pro' },
        },
      })
    })
  } finally {
    host.server.close()
  }
})
