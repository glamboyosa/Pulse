import Link from 'next/link'

import type { DocBlock } from '@/lib/widget-docs'
import { CopyButton } from '@/components/copy-button'
import { DocsInstallTabs } from '@/components/docs-install-tabs'
import { PulseLogo } from '@/components/pulse-logo'
import { env } from '@/env'
import { agentSetupPrompt } from '@/lib/widget-agents'
import { widgetDocs, widgetDocsMarkdown } from '@/lib/widget-docs'

const title = 'Website widget guide'
const description =
  'Add the Pulse voice feedback button to any website or app: install code for each framework, options, single-page apps, troubleshooting and security.'

export const metadata = { title, description }

/** Text with `code` spans, the only inline formatting the guide uses. */
const Inline = ({ text }: { text: string }) =>
  text.split(/(`[^`]+`)/).map((part, index) =>
    part.startsWith('`') ? (
      <code
        key={index}
        className="rounded-sm bg-secondary px-1 py-0.5 text-[0.9em] break-words"
      >
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  )

const Block = ({
  block,
  appUrl,
  section,
}: {
  block: DocBlock
  appUrl: string
  section: string
}) => {
  switch (block.kind) {
    case 'text':
      return (
        <p>
          <Inline text={block.text} />
        </p>
      )
    case 'question':
      return (
        <h3 className="pt-2 text-xl font-black">
          <Inline text={block.text} />
        </h3>
      )
    case 'list':
      return (
        <ul className="list-disc space-y-2 pl-6">
          {block.items.map((item) => (
            <li key={item}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      )
    case 'code':
      return (
        <div className="space-y-3">
          <pre className="overflow-x-auto border-2 border-foreground bg-secondary p-4 text-sm leading-relaxed">
            <code>{block.code}</code>
          </pre>
          <CopyButton
            text={block.code}
            describes={`${section}, ${block.language} example`}
          />
        </div>
      )
    case 'install':
      return <DocsInstallTabs appUrl={appUrl} />
  }
}

export default function WidgetDocsPage() {
  const appUrl = env.SERVER_URL ?? 'https://www.pulseapp.click'
  const sections = widgetDocs(appUrl)

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b-2 border-foreground">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4">
          <Link href="/software" className="inline-flex items-center gap-3">
            <PulseLogo className="size-8" />
            <span className="font-display text-2xl font-extrabold tracking-tight">
              Pulse
            </span>
          </Link>
          <Link href="/settings" className="font-bold hover:underline">
            Settings
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="mb-6 text-4xl font-black text-balance md:text-5xl">
          {title}
        </h1>
        <div className="mb-10 flex flex-wrap items-center gap-4">
          <CopyButton
            text={agentSetupPrompt(appUrl)}
            label="Copy prompt for your coding agent"
          />
          <CopyButton
            text={widgetDocsMarkdown(appUrl)}
            label="Copy as Markdown"
          />
          <a
            href="/docs/widget.md"
            className="font-bold underline underline-offset-4"
          >
            View as Markdown
          </a>
        </div>
        <nav aria-label="On this page" className="mb-12">
          <ul className="flex flex-wrap gap-x-5 gap-y-2 font-bold">
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} className="hover:underline">
                  {section.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-14">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="max-w-[65ch] scroll-mt-6 space-y-4 text-lg leading-relaxed"
            >
              <h2 className="text-3xl font-black text-balance">
                {section.title}
              </h2>
              {section.blocks.map((block, index) => (
                <Block
                  key={index}
                  block={block}
                  appUrl={appUrl}
                  section={section.title}
                />
              ))}
            </section>
          ))}
        </div>
        <p className="mt-14 border-t-2 border-foreground pt-8">
          <Link
            href="/privacy"
            className="font-bold underline underline-offset-4"
          >
            Privacy policy
          </Link>
        </p>
      </main>
    </div>
  )
}
