import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion-custom'

export function FaqSection() {
  return (
    <div className="w-full">
      <AccordionItem value="item-1">
        <AccordionTrigger>What are Pulses?</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4 text-balance">
          <p>
            Pulses are credits that power your feedback collection. Each time a
            customer leaves you voice feedback, it uses one Pulse. Think of them
            like AI credits—you purchase Pulses in packages and top up as
            needed.
          </p>
          <p>
            This simple pay-as-you-grow model means you only pay for the
            feedback you collect, with no monthly subscriptions or hidden fees.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-2">
        <AccordionTrigger>How does voice feedback work?</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4 text-balance">
          <p>
            After signing up, you'll receive a unique QR code for your business.
            Place it wherever customers can scan it—receipts, tables, packaging,
            or signage.
          </p>
          <p>
            When customers scan the code, they're taken to a simple page where
            they can record up to 2 minutes of voice feedback. No apps or
            accounts required. The feedback is automatically transcribed and
            appears in your dashboard instantly.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-3">
        <AccordionTrigger>Do I need a subscription?</AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4 text-balance">
          <p>
            No subscriptions required. Pulse uses a simple credit-based system.
            You purchase Pulses in packages that suit your needs—whether you're
            a small cafe collecting occasional feedback or a busy restaurant
            gathering hundreds of responses.
          </p>
          <p>
            Your Pulses never expire, and you can top up anytime. It's flexible,
            transparent, and scales with your business.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-4">
        <AccordionTrigger>
          Is customer data private and secure?
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4 text-balance">
          <p>
            Absolutely. All voice recordings and transcripts are encrypted and
            stored securely. We're fully GDPR compliant and take customer
            privacy seriously.
          </p>
          <p>
            Customers can optionally provide their name, but it's never
            required. You control who has access to your feedback dashboard, and
            customers can request deletion of their feedback anytime.
          </p>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="item-5">
        <AccordionTrigger>
          What languages does transcription support?
        </AccordionTrigger>
        <AccordionContent className="flex flex-col gap-4 text-balance">
          <p>
            Our automatic transcription supports over 50 languages including
            English, Spanish, French, German, Italian, Portuguese, Dutch,
            Polish, Turkish, Russian, Arabic, Hindi, Japanese, Chinese, and
            Korean.
          </p>
          <p>
            The system automatically detects the language being spoken and
            provides accurate transcriptions, making Pulse perfect for
            international businesses and diverse customer bases.
          </p>
        </AccordionContent>
      </AccordionItem>
    </div>
  )
}
