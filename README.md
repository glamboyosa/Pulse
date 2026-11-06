# Pulse

**Pulse** is a AI SaaS platform that helps businesses collect authentic voice feedback from customers through simple QR codes. Instead of traditional text surveys, customers scan a QR code and leave voice messages that are automatically transcribed, analyzed for sentiment, and displayed in a real-time dashboard.

🌐 **Live at:** [pulseapp.click](https://pulseapp.click)

## Features

- 🎤 **Voice Feedback Collection** - Customers record voice messages via QR code scanning
- 📝 **Automatic Transcription** - Powered by ElevenLabs Speech-to-Text
- 😊 **Sentiment Analysis** - Automatically categorizes feedback as positive, neutral, or negative
- 📊 **Real-Time Dashboard** - View all feedback with audio playback and transcripts
- 🔗 **Unique QR Codes** - Each business gets a custom QR code for feedback collection
- 💳 **Credit-Based System** - Pay-as-you-go model with Pulse credits
- 🔒 **Privacy First** - GDPR compliant with encrypted storage
- 📧 **OTP Authentication** - Secure email-based login system

## Tech Stack

### Frontend
- **[Next.js](https://nextjs.org/)** - Full-stack React framework with App Router and SSR
- **[React](https://react.dev/)** - UI library
- **[TanStack Query](https://tanstack.com/query)** - Data fetching and state management
- **[Tailwind CSS](https://tailwindcss.com/)** - Styling
- **[Shadcn UI](https://ui.shadcn.com/)** - UI components
- **[Lucide React](https://lucide.dev/)** - Icons
- **[React QR Code](https://github.com/rosskhanas/react-qr-code)** - QR code generation

### Backend
- **[ElysiaJS](https://elysiajs.com/)** - Fast web framework for API routes
- **[Eden Treaty](https://elysiajs.com/plugins/eden/treaty.html)** - End-to-end type safety
- **[Drizzle ORM](https://orm.drizzle.team/)** - TypeScript ORM
- **[Neon Database](https://neon.tech/)** - Serverless PostgreSQL
- **[Resend](https://resend.com/)** - Transactional emails
- **[ElevenLabs](https://elevenlabs.io/)** - Speech-to-text transcription
- **[AI SDK](https://ai-sdk.dev/)** with OpenAI, falling back to OpenRouter - Sentiment analysis and name extraction
- **[Cloudflare R2](https://www.cloudflare.com/products/r2/)** - Object storage for audio files

### Development Tools
- **[Next.js Compiler](https://nextjs.org/docs/architecture/nextjs-compiler)** - Application build and bundling
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Zod](https://zod.dev/)** - Schema validation
- **[T3 Env](https://env.t3.gg/)** - Type-safe environment variables for Next.js
- **[Vitest](https://vitest.dev/)** - Unit and API tests against a real Postgres
- **[Playwright](https://playwright.dev/)** - End-to-end tests in desktop and mobile Chrome
- **[ESLint](https://eslint.org/)** & **[Prettier](https://prettier.io/)** - Code quality

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- A Neon database (or PostgreSQL)
- Cloudflare R2 account (for audio storage)
- OpenAI or OpenRouter API key
- ElevenLabs API key
- Resend API key (for emails)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pulse
```

2. Install dependencies:
```bash
bun install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

4. Configure your `.env` file with the required variables (see [Environment Variables](#environment-variables))

5. Set up the database:
```bash
bun run db:push
```

6. Start the development server:
```bash
bun run dev
```

The application will be available at `http://localhost:3000`

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server
SERVER_URL=http://localhost:3000
SESSION_SECRET=your-session-secret-min-32-chars

# Database
DATABASE_URL=your-neon-postgres-connection-string

# Email (Resend)
SERVER_RESEND_API_KEY=your-resend-api-key

# AI (OpenAI first, OpenRouter as fallback)
OPENAI_API_KEY=your-openai-api-key
OPENROUTER_API_KEY=your-openrouter-api-key

# Speech-to-text (ElevenLabs)
ELEVEN_LABS_API_KEY=your-elevenlabs-api-key

# Storage (Cloudflare R2)
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_ACCESS_KEY_ID=your-r2-access-key-id
CLOUDFLARE_SECRET_ACCESS_KEY=your-r2-secret-access-key
CLOUDFLARE_R2_BUCKET_NAME=your-bucket-name

# Payments (Polar.sh). POLAR_ENVIRONMENT picks which pair is used.
POLAR_ENVIRONMENT=sandbox
POLAR_API_KEY=your-polar-production-token
POLAR_WEBHOOK_SECRET=your-polar-production-webhook-secret
POLAR_SANDBOX_API_TOKEN=your-polar-sandbox-token
POLAR_SANDBOX_WEBHOOK_SECRET=your-polar-sandbox-webhook-secret

# Client
NEXT_PUBLIC_APP_TITLE=Pulse
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Database Setup

This project uses **Neon** (serverless PostgreSQL) with **Drizzle ORM**.

### Database Commands

```bash
# Generate migrations
bun run db:generate

# Push schema changes to database
bun run db:push

# Run migrations
bun run db:migrate

# Open Drizzle Studio (database GUI)
bun run db:studio
```

### Neon Setup

Create a Neon Postgres database, copy the connection string into `DATABASE_URL`, then run `bun run db:push` to apply the Drizzle schema.

## Project Structure

```
pulse/
├── app/
│   ├── api/[[...slugs]]/   # Elysia API mounted inside Next.js
│   ├── dashboard/          # Business dashboard
│   ├── f/[id]/             # Public QR-code feedback page
│   ├── login/              # OTP login page
│   └── ...                 # Other App Router routes
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # Shadcn UI components
│   │   └── ...
│   ├── lib/                # Utility libraries
│   │   ├── ai/             # AI integrations (ElevenLabs + Gemini)
│   │   ├── storage/        # Storage utilities (R2)
│   │   └── utils/          # Helper utilities
│   ├── db/                 # Database schema and migrations
│   ├── emails/             # React Email templates
│   ├── contexts/           # React contexts (Auth, etc.)
│   └── styles.css          # Global styles
├── public/                 # Static assets
└── package.json
```

## Available Scripts

```bash
# Development
bun run dev              # Start dev server on port 3000

# Building
bun run build           # Build for production
bun run start           # Start production server

# Database
bun run db:generate     # Generate migrations
bun run db:push         # Push schema to database
bun run db:migrate      # Run migrations
bun run db:studio       # Open Drizzle Studio

# Code Quality
bun run lint            # Run ESLint
bun run format          # Format with Prettier
bun run check           # Format and lint

# Tunnels
bun run dev:tunnel      # Expose local app with ngrok

# Tests
bun run test            # Unit and API tests (Vitest)
bun run test:e2e        # Browser journey (Playwright) against a running app
```

### Tests

Vitest runs against a real Postgres database called `pulse_test` on `localhost:5440`. It wipes that database between tests, so never point it anywhere else. Create and migrate it once:

```bash
createdb -h localhost -p 5440 -U postgres pulse_test
DATABASE_URL=postgres://postgres@localhost:5440/pulse_test bun run db:migrate
```

The Playwright journey signs a business up, records feedback as a customer, waits for the real ElevenLabs transcript, plays it back and checks the out-of-pulses state. It needs the dev server running with real ElevenLabs, AI, R2 and Resend keys. It reads login codes from the app's database, set with `E2E_DATABASE_URL` (default `postgres://postgres@localhost:5440/pulse_dev`). Run `bunx playwright install chromium` once first.

## Key Features Implementation

### Authentication
- OTP-based email authentication
- Session management with HTTP-only cookies
- Protected dashboard routes via server-side auth checks

### Voice Feedback
- Customers record up to 2 minutes, listen back, then send one upload
- Each submission spends one pulse atomically; a failed upload gives it back
- Transcription with ElevenLabs runs after the response, so customers never wait
- Sentiment and customer name come from the AI SDK (OpenAI, then OpenRouter)
- Submissions are rate limited per connection and per business

### Storage
- Audio files stored in Cloudflare R2
- Presigned URLs for secure access
- Keys are made on the server: `feedback/{userId}/{feedbackId}.{ext}`

### Payments
- Credit-based system (Pulses)
- Integration with Polar.sh for payment processing
- Packs of 10, 25, 50 and 100 pulses, or a custom amount priced at the matching pack rate
- The `order.paid` webhook credits pulses once per Polar order; `order.refunded` removes them pro rata
- New accounts start with 5 free pulses

## Adding Components

This project uses [Shadcn UI](https://ui.shadcn.com/). To add new components:

```bash
pnpx shadcn@latest add button
pnpx shadcn@latest add card
# etc.
```

## Type Safety

- **Environment Variables**: Type-safe with `@t3-oss/env-core`
- **API Routes**: End-to-end type safety with Eden Treaty
- **Database**: Type-safe queries with Drizzle ORM
- **Forms**: Schema validation with Zod

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [ElysiaJS Documentation](https://elysiajs.com/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Neon Documentation](https://neon.tech/docs)

## License

Private - All rights reserved

---

Built with ❤️ by [Timothy Osaretin Ogbemudia](https://glamboyosa.xyz)
