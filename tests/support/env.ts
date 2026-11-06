// Point everything at the throwaway test database and fake secrets before any
// app module reads its environment.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgres://postgres@localhost:5440/pulse_test'
process.env.SESSION_SECRET = 'test-session-secret-that-is-at-least-32-chars'
process.env.POLAR_ENVIRONMENT = 'sandbox'
process.env.POLAR_SANDBOX_API_TOKEN = 'test-polar-token'
process.env.POLAR_SANDBOX_WEBHOOK_SECRET = 'test-webhook-secret'
process.env.SERVER_URL = 'https://pulse.test'
process.env.CRON_SECRET = 'test-cron-secret'
