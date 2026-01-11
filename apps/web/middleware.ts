import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // Allow NextAuth/auth routes to bypass tenant requirement (super-admin login etc.)
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/api/super-admin')) {
    return NextResponse.next()
  }

  // API routes require tenant ID by default
  if (pathname.startsWith('/api/')) {
    const tenantId = request.headers.get('x-tenant-id')

    if (!tenantId) {
      return NextResponse.json(
        { error: 'Tenant ID is required' },
        { status: 400 }
      )
    }

    // Add tenant ID to request headers for database operations
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-tenant-id', tenantId)

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}