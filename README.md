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
- **[Google Gemini AI](https://ai.google.dev/)** - Sentiment analysis and name extraction
- **[Cloudflare R2](https://www.cloudflare.com/products/r2/)** - Object storage for audio files

### Development Tools
- **[Next.js Compiler](https://nextjs.org/docs/architecture/nextjs-compiler)** - Application build and bundling
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Zod](https://zod.dev/)** - Schema validation
- **[T3 Env](https://env.t3.gg/)** - Type-safe environment variables for Next.js
- **[Vitest](https://vitest.dev/)** - Testing framework
- **[ESLint](https://eslint.org/)** & **[Prettier](https://prettier.io/)** - Code quality

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or Node.js 18+
- A Neon database (or PostgreSQL)
- Cloudflare R2 account (for audio storage)
- Google Gemini API key
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

# AI (Google Gemini)
SERVER_GEMINI_API_KEY=your-gemini-api-key

# Speech-to-text (ElevenLabs)
ELEVEN_LABS_API_KEY=your-elevenlabs-api-key

# Storage (Cloudflare R2)
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_ACCESS_KEY_ID=your-r2-access-key-id
CLOUDFLARE_SECRET_ACCESS_KEY=your-r2-secret-access-key
CLOUDFLARE_R2_BUCKET_NAME=your-bucket-name

# Payments (Polar.sh)
POLAR_API_KEY=your-polar-api-key

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
```

## Key Features Implementation

### Authentication
- OTP-based email authentication
- Session management with HTTP-only cookies
- Protected dashboard routes via server-side auth checks

### Voice Feedback
- Real-time audio streaming (WhatsApp-like experience)
- Chunks uploaded every 2 seconds during recording
- Automatic transcription with ElevenLabs Speech-to-Text
- Sentiment analysis with Google Gemini (positive/neutral/negative)
- Customer name extraction from transcripts with Google Gemini

### Storage
- Audio files stored in Cloudflare R2
- Presigned URLs for secure access
- Unique keys per feedback: `feedback/{userId}/{feedbackId}/audio.webm`

### Payments
- Credit-based system (Pulses)
- Integration with Polar.sh for payment processing
- Packages: 10, 25, 50, 100 pulses

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
