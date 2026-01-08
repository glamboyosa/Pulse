# Pulse

**Pulse** is a SaaS platform that helps businesses collect authentic voice feedback from customers through simple QR codes. Instead of traditional text surveys, customers scan a QR code and leave voice messages that are automatically transcribed, analyzed for sentiment, and displayed in a real-time dashboard.

🌐 **Live at:** [pulseapp.click](https://pulseapp.click)

## Features

- 🎤 **Voice Feedback Collection** - Customers record voice messages via QR code scanning
- 📝 **Automatic Transcription** - Powered by Google Gemini AI
- 😊 **Sentiment Analysis** - Automatically categorizes feedback as positive, neutral, or negative
- 📊 **Real-Time Dashboard** - View all feedback with audio playback and transcripts
- 🔗 **Unique QR Codes** - Each business gets a custom QR code for feedback collection
- 💳 **Credit-Based System** - Pay-as-you-go model with Pulse credits
- 🔒 **Privacy First** - GDPR compliant with encrypted storage
- 📧 **OTP Authentication** - Secure email-based login system

## Tech Stack

### Frontend
- **[TanStack Start](https://tanstack.com/start)** - Full-stack React framework with SSR
- **[TanStack Router](https://tanstack.com/router)** - Type-safe routing
- **[TanStack Query](https://tanstack.com/query)** - Data fetching and state management
- **[React](https://react.dev/)** - UI library
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
- **[Google Gemini AI](https://ai.google.dev/)** - Audio transcription and sentiment analysis
- **[Cloudflare R2](https://www.cloudflare.com/products/r2/)** - Object storage for audio files

### Development Tools
- **[Vite](https://vitejs.dev/)** - Build tool
- **[TypeScript](https://www.typescriptlang.org/)** - Type safety
- **[Zod](https://zod.dev/)** - Schema validation
- **[T3 Env](https://env.t3.gg/)** - Type-safe environment variables
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

# Storage (Cloudflare R2)
CLOUDFLARE_ACCOUNT_ID=your-cloudflare-account-id
CLOUDFLARE_ACCESS_KEY_ID=your-r2-access-key-id
CLOUDFLARE_SECRET_ACCESS_KEY=your-r2-secret-access-key
CLOUDFLARE_R2_BUCKET_NAME=your-bucket-name

# Payments (Polar.sh)
POLAR_API_KEY=your-polar-api-key

# Client
VITE_APP_TITLE=Pulse
VITE_APP_URL=http://localhost:3000
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

### Auto-Setup with Neon

When running `bun run dev`, the `@neondatabase/vite-plugin-postgres` will automatically detect if there's no database setup and create a claimable database for you (similar to [Neon Launchpad](https://neon.new)).

> ⚠️ **Important:** Claimable databases expire in 72 hours. Make sure to claim your database and update your `DATABASE_URL`.

## Project Structure

```
pulse/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # Shadcn UI components
│   │   └── ...
│   ├── routes/             # TanStack Router file-based routes
│   │   ├── _authed/        # Protected routes
│   │   ├── api.$/          # Elysia API routes
│   │   └── ...
│   ├── lib/                # Utility libraries
│   │   ├── ai/             # AI integrations (Gemini)
│   │   ├── server-functions/# TanStack Start server functions
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
bun run serve           # Preview production build

# Database
bun run db:generate     # Generate migrations
bun run db:push         # Push schema to database
bun run db:migrate      # Run migrations
bun run db:studio       # Open Drizzle Studio

# Code Quality
bun run lint            # Run ESLint
bun run format          # Format with Prettier
bun run check           # Format and lint

# Testing
bun run test            # Run tests with Vitest
```

## Key Features Implementation

### Authentication
- OTP-based email authentication
- Session management with HTTP-only cookies
- Protected routes with `_authed` layout

### Voice Feedback
- Real-time audio streaming (WhatsApp-like experience)
- Chunks uploaded every 2 seconds during recording
- Automatic transcription with Google Gemini
- Sentiment analysis (positive/neutral/negative)
- Customer name extraction from transcripts

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

- [TanStack Start Documentation](https://tanstack.com/start)
- [TanStack Router Documentation](https://tanstack.com/router)
- [ElysiaJS Documentation](https://elysiajs.com/)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [Neon Documentation](https://neon.tech/docs)

## License

Private - All rights reserved

---

Built with ❤️ by [Timothy Osaretin Ogbemudia](https://glamboyosa.xyz)
