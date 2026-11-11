import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

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
      // Redirect to login if no session
      return NextResponse.redirect(new URL('/login', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding/:path*', '/embed/:path*'],
}
