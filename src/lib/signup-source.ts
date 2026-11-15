// Where a new owner came from, such as "meta/ng-founders" from an ad link
// tagged ?utm_source=meta&utm_campaign=ng-founders. The first tagged visit
// sets a cookie; signing up copies it onto the account.
export const SIGNUP_SOURCE_COOKIE = 'pulse_ref'
export const SIGNUP_SOURCE_MAX_AGE = 30 * 24 * 60 * 60

const PART = /^[a-z0-9_-]{1,40}$/

/** The source a landing URL is tagged with, or null when it isn't. */
export const signupSourceFrom = (params: URLSearchParams) => {
  const source = params.get('utm_source')?.toLowerCase() ?? ''
  if (!PART.test(source)) return null
  const campaign = params.get('utm_campaign')?.toLowerCase() ?? ''
  return PART.test(campaign) ? `${source}/${campaign}` : source
}

const SHAPE = /^[a-z0-9_-]{1,40}(\/[a-z0-9_-]{1,40})?$/

/** The cookie's value if it has the shape signupSourceFrom makes, else null. */
export const parseSignupSource = (value: string | undefined) =>
  value !== undefined && SHAPE.test(value) ? value : null
