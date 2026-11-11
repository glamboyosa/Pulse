import type { WidgetContext } from '@/server/widget'

/**
 * Where a widget note was left, as the owner's website reported it. The
 * website sent these values, so they are shown as plain text only.
 */
export function WidgetContextDetails({
  context,
}: {
  context: WidgetContext | null
}) {
  const rows: Array<[string, string | undefined]> = [
    ['Page', context?.page],
    ['Page title', context?.title],
    ['Came from', context?.referrer],
    ['App version', context?.appVersion],
    ['User', context?.userId],
    ['User email (unverified)', context?.userEmail],
    ['Browser', context?.browser],
    ['Screen', context?.screen],
    ['Language', context?.language],
    // Labelled, so a custom field named "Page" can't pass for the real one.
    ...Object.entries(context?.custom ?? {}).map(
      ([name, value]): [string, string] => [`${name} (from your site)`, value],
    ),
  ]
  const shown = rows.filter((row): row is [string, string] => Boolean(row[1]))

  return (
    <section className="rounded-md border-2 border-foreground p-4">
      <h2 className="mb-3 text-lg font-black">Left on your website</h2>
      {shown.length === 0 ? (
        <p className="font-medium text-muted-foreground">
          The website didn&apos;t send any page details.
        </p>
      ) : (
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[max-content_1fr]">
          {shown.map(([label, value], index) => (
            <div key={index} className="contents">
              <dt className="font-bold">{label}</dt>
              <dd className="break-words font-medium text-muted-foreground">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}
