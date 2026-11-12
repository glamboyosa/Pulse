/**
 * Where to go after signing in: a dashboard page the person was sent away
 * from, such as a voucher's redeem link. Anything else goes to the dashboard,
 * so the login link can't send people to another site.
 */
export const dashboardReturnPath = (value: unknown): string =>
  typeof value === 'string' &&
  /^\/dashboard(\/[\w/-]*)?(\?[^#\s]*)?$/.test(value)
    ? value
    : '/dashboard'
