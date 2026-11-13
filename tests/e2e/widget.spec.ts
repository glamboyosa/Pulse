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
    () => `<!doctype html><title>Billing</title><h1>Host app</h1>
      <script>window.PulseQueue = [['identify', { id: 'user-42' }]]</script>
      ${snippet}
      <script>addEventListener('load', () => {
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
      await page.getByRole('button', { name: 'Ask a question' }).click()
      await page.getByLabel('Panel title').fill('What went wrong?')
      await expect(page.locator('pre code')).toContainText(
        'data-label="Ask a question"',
      )
    })
    snippet = await page.locator('pre code').innerText()

    await test.step('a visitor records a note through the widget', async () => {
      // The project's device (desktop or Pixel 7), so mobile gets the narrow layout.
      const { baseURL: _baseURL, ...device } = testInfo.project.use
      const visitor = await browser.newContext(device)
      // A website shown inside someone's React Native app: the framed
      // widget talks to the website, never to that app's bridge.
      await visitor.addInitScript(() => {
        const bridged: Array<string> = []
        Object.assign(window, {
          bridged,
          ReactNativeWebView: {
            postMessage: (raw: string) => bridged.push(raw),
          },
        })
      })
      const site = await customerWithVoice(visitor)
      await site.goto(`${host.origin}/start`)
      // A single-page app changes route and swaps <body>, like Turbo does.
      await site.getByRole('button', { name: 'Ask a question' }).waitFor()
      await site.evaluate(() => {
        document.body.replaceWith(document.createElement('body'))
      })
      await site.getByRole('button', { name: 'Ask a question' }).click()
      const widget = site.frameLocator('iframe[title="What went wrong?"]')
      await expect(
        widget.getByRole('heading', { name: 'What went wrong?' }),
      ).toBeVisible()
      // The route changes while the panel is open: the note gets the new page.
      await site.evaluate(() => {
        history.pushState({}, '', '/billing?token=secret')
      })
      await widget.getByRole('button', { name: 'START RECORDING' }).click()
      await site.waitForTimeout(6000)
      await widget.getByRole('button', { name: 'STOP' }).click()
      await widget.getByRole('button', { name: 'SEND FEEDBACK' }).click()
      // Sending uploads the recording to R2 first.
      await expect(widget.getByText('THANK YOU!')).toBeVisible({
        timeout: 20_000,
      })
      const embed = site
        .frames()
        .find((frame) => frame.url().includes('/embed/'))
      expect(
        await embed?.evaluate(
          () => (window as unknown as { bridged: Array<string> }).bridged,
        ),
      ).toEqual([])
      // Escape inside the widget closes it on the host page.
      await widget.getByText('THANK YOU!').press('Escape')
      await expect(
        site.getByRole('button', { name: 'Ask a question' }),
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

const BLACK = 'rgb(17, 17, 17)'
const WHITE = 'rgb(255, 255, 255)'

// A host site whose stylesheet arrives late, after the widget has run.
const serveThemedSite = (css: string, body = '<h1>Host app</h1>') =>
  new Promise<{ server: Server; origin: string }>((resolve, reject) => {
    const server = createServer((request, response) => {
      if (request.url === '/site.css') {
        setTimeout(() => {
          response.writeHead(200, { 'content-type': 'text/css' })
          response.end(css)
        }, 1500)
        return
      }
      response.writeHead(200, { 'content-type': 'text/html' })
      response.end(`<!doctype html><title>Themed</title>
        <link rel="stylesheet" href="/site.css">
        ${body}
        <script src="${test.info().project.use.baseURL}/widget.js" data-key="pk_theme_test" async></script>`)
    })
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      resolve({ server, origin: `http://localhost:${port}` })
    })
  })

test('the default button contrasts with the page when the site has its own theme switch', async ({
  page,
}) => {
  const host = await serveThemedSite(`
    :root { background: oklch(1 0 0) }
    :root[data-theme='dark'] { background: oklch(0.2 0 0) }`)
  try {
    // The device says dark, but the site starts in its own light theme.
    await page.emulateMedia({ colorScheme: 'dark' })
    await page.goto(host.origin)
    const button = page.getByRole('button', { name: 'Feedback' })
    await expect(button).toHaveCSS('background-color', BLACK)

    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'dark'
    })
    await expect(button).toHaveCSS('background-color', WHITE)

    await page.evaluate(() => {
      document.documentElement.dataset.theme = 'light'
    })
    await expect(button).toHaveCSS('background-color', BLACK)
  } finally {
    host.server.close()
  }
})

test('the default button reads faint tints, wrapper backgrounds and unpainted pages', async ({
  page,
}) => {
  const sites = [
    // A faint grey tint over the white canvas is still a light page.
    {
      css: 'body { background: rgba(0, 0, 0, 0.04) }',
      device: 'dark',
      expected: BLACK,
    },
    // The page paints a full-height wrapper, not <body>.
    {
      css: '#root { min-height: 100vh; background: #0a0a0a }',
      body: '<div id="root"><h1>Host app</h1></div>',
      device: 'light',
      expected: WHITE,
    },
    // A dark hero in the corner at load is not the theme of a light page.
    {
      css: 'body { margin: 0; background: #fff } .hero { height: 100vh; background: #000 } .rest { height: 300vh }',
      body: '<div class="hero"></div><div class="rest"></div>',
      device: 'light',
      expected: BLACK,
    },
    // Nothing painted: the browser's canvas is white unless the site opts
    // into dark mode with color-scheme.
    { css: '', device: 'dark', expected: BLACK },
    {
      css: ':root { color-scheme: light dark }',
      device: 'dark',
      expected: WHITE,
    },
    {
      css: ':root { color-scheme: light dark }',
      device: 'light',
      expected: BLACK,
    },
  ] as const
  for (const site of sites) {
    const host = await serveThemedSite(
      site.css,
      'body' in site ? site.body : undefined,
    )
    try {
      await page.emulateMedia({ colorScheme: site.device })
      await page.goto(host.origin)
      await expect(page.getByRole('button', { name: 'Feedback' })).toHaveCSS(
        'background-color',
        site.expected,
      )
    } finally {
      host.server.close()
    }
  }
})

test('the icon-only button ignores its own colour when reading the page', async ({
  page,
}) => {
  const host = await serveSite(
    () => `<!doctype html><title>Circle</title><style>body { background: #fff }</style>
      <script src="${test.info().project.use.baseURL}/widget.js" data-key="pk_theme_test" data-shape="circle" async></script>`,
  )
  try {
    await page.emulateMedia({ colorScheme: 'light' })
    await page.goto(host.origin)
    const button = page.getByRole('button', { name: 'Feedback' })
    const settle = () =>
      page.evaluate(
        () =>
          new Promise((done) =>
            requestAnimationFrame(() => requestAnimationFrame(done)),
          ),
      )
    // Each repaint must keep it black, not flip it.
    for (const name of ['first', 'second']) {
      await settle()
      await expect(button).toHaveCSS('background-color', BLACK)
      await page.evaluate(
        (className) => document.body.classList.add(className),
        name,
      )
    }
    await settle()
    await expect(button).toHaveCSS('background-color', BLACK)
  } finally {
    host.server.close()
  }
})

test('a React Native app hears from the widget and passes its user', async ({
  page,
  browser,
}, testInfo) => {
  const code = `e2e-native-${Date.now()}`
  await signUpBusiness(
    page,
    `${code}@example.test`,
    code,
    'On my website or app',
  )
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Turn on the widget' }).click()
  const install = await page.locator('pre code').innerText()
  const key = /data-key="(pk_[^"]+)"/.exec(install)?.[1]
  expect(key).toBeTruthy()

  const { baseURL, ...device } = testInfo.project.use
  const embedUrl = `${baseURL}/embed/${key}?heading=What%20went%20wrong%3F`

  await test.step('a shared link ignores the heading and has no app close button', async () => {
    const browserTab = await browser.newPage()
    await browserTab.goto(embedUrl)
    await expect(
      browserTab.getByRole('heading', { name: 'What went wrong?' }),
    ).toHaveCount(0)
    await expect(browserTab.getByRole('button', { name: 'Close' })).toHaveCount(
      0,
    )
    await browserTab.close()
  })

  // The docs' component sends this header with the first request.
  const app = await browser.newContext({
    ...device,
    extraHTTPHeaders: { 'x-pulse-app': '1' },
  })
  // What react-native-webview provides, and what the docs' component does
  // with it: answer pulse:ready with the app's user.
  await app.addInitScript(() => {
    const heard: Array<string> = []
    Object.assign(window, {
      heard,
      ReactNativeWebView: {
        postMessage: (raw: string) => {
          const { type } = JSON.parse(raw) as { type: string }
          heard.push(type)
          if (type === 'pulse:ready') {
            window.postMessage(
              {
                type: 'pulse:context',
                context: {
                  userId: 'user-7',
                  appVersion: '2.0.0',
                  custom: { plan: 'pro' },
                },
              },
              '*',
            )
          }
        },
      },
    })
  })
  const screen = await customerWithVoice(app)
  // Opened as the whole screen, not in a frame, and the app isn't a listed site.
  await screen.goto(embedUrl)
  await expect(
    screen.getByRole('heading', { name: 'What went wrong?' }),
  ).toBeVisible()
  await screen.getByRole('button', { name: 'START RECORDING' }).click()
  await screen.waitForTimeout(6000)
  await screen.getByRole('button', { name: 'STOP' }).click()
  await screen.getByRole('button', { name: 'SEND FEEDBACK' }).click()
  await expect(screen.getByText('THANK YOU!')).toBeVisible({ timeout: 20_000 })
  await screen.getByRole('button', { name: 'Close' }).click()
  expect(
    await screen.evaluate(
      () => (window as unknown as { heard: Array<string> }).heard,
    ),
  ).toEqual(['pulse:ready', 'pulse:sent', 'pulse:close'])
  await app.close()

  const result = await db.query<{ channel: string; context: unknown }>(
    `select f.channel, f.context from feedback f
     join users u on u.id = f.user_id where u.unique_code = $1`,
    [code],
  )
  expect(result.rows).toHaveLength(1)
  expect(result.rows[0]).toEqual({
    channel: 'widget',
    context: { userId: 'user-7', appVersion: '2.0.0', custom: { plan: 'pro' } },
  })
})
