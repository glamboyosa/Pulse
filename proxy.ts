import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

import {
  SIGNUP_SOURCE_COOKIE,
  SIGNUP_SOURCE_MAX_AGE,
  signupSourceFrom,
} from '@/lib/signup-source'
import { embedHeaders, widgetByKey } from '@/server/widget'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // The website widget's page: only the owner's listed sites may frame it.
  // Any other path under /embed/ (a 404) may be framed by nobody.
  if (pathname.startsWith('/embed/')) {
    const key = pathname.slice('/embed/'.length)
    const widget = /^[\w-]+$/.test(key) ? await widgetByKey(key) : null
    const response = NextResponse.next()
    for (const [name, value] of Object.entries(
      embedHeaders(widget?.origins ?? []),
    )) {
      response.headers.set(name, value)
    }
    return response
  }

  // Check if the route requires authentication
  const isAuthRoute =
    pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding')

  if (isAuthRoute) {
    const session = request.cookies.get('session')

    if (!session) {
      // Redirect to login if no session, coming back here afterwards.
      const login = new URL('/login', request.url)
      login.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
      return NextResponse.redirect(login)
    }
  }

  const response = NextResponse.next()
  // Remember the first tagged link someone arrived from, for their signup.
  const source = signupSourceFrom(request.nextUrl.searchParams)
  if (source && !request.cookies.has(SIGNUP_SOURCE_COOKIE)) {
    response.cookies.set(SIGNUP_SOURCE_COOKIE, source, {
      maxAge: SIGNUP_SOURCE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      path: '/',
    })
  }
  return response
}

export const config = {
  matcher: [
    '/',
    '/software',
    '/dashboard/:path*',
    '/onboarding/:path*',
    '/embed/:path*',
  ],
}
