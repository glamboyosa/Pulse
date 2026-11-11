// Builds the install snippet and framework examples from an owner's choices.
// Only options that differ from widget.js's defaults are written out.

export type WidgetShape = 'pill' | 'square' | 'circle' | 'bubble'

export type WidgetOptions = {
  label: string
  shape: WidgetShape
  /** 'auto' follows the visitor's light or dark mode. */
  color: string
  position: 'right' | 'left'
  heading: string
}

export const DEFAULT_WIDGET_OPTIONS: WidgetOptions = {
  label: 'Feedback',
  shape: 'pill',
  color: 'auto',
  position: 'right',
  heading: '',
}

export const LABEL_SUGGESTIONS = [
  'Feedback',
  'Leave a voice note',
  'Ask a question',
  'Report a problem',
  'Tell us what you think',
]

export type Framework = 'html' | 'next' | 'react' | 'astro' | 'vue' | 'nocode'

export const FRAMEWORKS: Array<{ id: Framework; name: string }> = [
  { id: 'html', name: 'HTML' },
  { id: 'next', name: 'Next.js' },
  { id: 'react', name: 'React (Vite)' },
  { id: 'astro', name: 'Astro' },
  { id: 'vue', name: 'Vue / Nuxt' },
  { id: 'nocode', name: 'WordPress, Webflow, Framer' },
]

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

/** The data-* attributes for the chosen options, defaults left out. */
export const widgetAttributes = (
  key: string,
  options: WidgetOptions,
): Array<[string, string]> => {
  const attributes: Array<[string, string]> = [['data-key', key]]
  const label = options.label.trim()
  if (label && label !== DEFAULT_WIDGET_OPTIONS.label) {
    attributes.push(['data-label', label])
  }
  if (options.shape !== DEFAULT_WIDGET_OPTIONS.shape) {
    attributes.push(['data-shape', options.shape])
  }
  if (options.color !== DEFAULT_WIDGET_OPTIONS.color) {
    attributes.push(['data-color', options.color])
  }
  if (options.position !== DEFAULT_WIDGET_OPTIONS.position) {
    attributes.push(['data-position', options.position])
  }
  if (options.heading.trim()) {
    attributes.push(['data-heading', options.heading.trim()])
  }
  return attributes
}

const htmlAttributes = (attributes: Array<[string, string]>) =>
  attributes.map(([name, value]) => `${name}="${escapeAttribute(value)}"`)

/** The plain HTML snippet, for any website. */
export const widgetSnippet = (
  appUrl: string,
  key: string,
  options: WidgetOptions,
) =>
  `<script src="${appUrl}/widget.js" ${htmlAttributes(widgetAttributes(key, options)).join(' ')} async></script>`

/** The same install, written the way each framework expects. */
export const frameworkExample = (
  framework: Framework,
  appUrl: string,
  key: string,
  options: WidgetOptions,
): string => {
  const attributes = htmlAttributes(widgetAttributes(key, options))
  const indented = (spaces: number) =>
    attributes.map((attribute) => ' '.repeat(spaces) + attribute).join('\n')
  const tag = widgetSnippet(appUrl, key, options)

  switch (framework) {
    case 'html':
      return `<!-- Paste before </body> -->\n${tag}`
    case 'next':
      return `// app/layout.tsx: next/script works in a Server Component.
import Script from 'next/script'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
        <Script
          src="${appUrl}/widget.js"
${indented(10)}
          strategy="afterInteractive"
        />
      </body>
    </html>
  )
}`
    case 'react':
      return `<!-- index.html, before </body> -->
${tag}`
    case 'astro':
      return `---
// src/layouts/Layout.astro
---
<body>
  <slot />
  <script
    is:inline
    src="${appUrl}/widget.js"
${indented(4)}
    async
  ></script>
</body>`
    case 'vue':
      return `<!-- Vue: index.html, before </body> -->
${tag}

// Nuxt: nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      script: [
        {
          src: '${appUrl}/widget.js',
          async: true,
${widgetAttributes(key, options)
  .map(([name, value]) => `          '${name}': ${JSON.stringify(value)},`)
  .join('\n')}
          tagPosition: 'bodyClose',
        },
      ],
    },
  },
})`
    case 'nocode':
      return `Paste this into your site's custom code, in the footer or "before </body>" box:

${tag}

WordPress: Appearance > Theme File Editor > footer.php, or a "header and footer scripts" plugin.
Webflow: Site settings > Custom code > Footer code.
Framer: Site settings > General > Custom code > End of <body> tag.
Squarespace: Settings > Advanced > Code injection > Footer.`
  }
}
