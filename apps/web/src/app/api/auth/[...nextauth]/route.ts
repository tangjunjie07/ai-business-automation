import NextAuth from 'next-auth'
import { JWT } from 'next-auth/jwt'
import { PrismaClient } from '@prisma/client'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient()
  }
  return globalForPrisma.prisma
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        tenantCode: { label: 'Tenant Code', type: 'text' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password || !credentials?.tenantCode) {
          return null
        }

        // Find tenant by code
        const tenant = await getPrisma().tenant.findUnique({
          where: { code: credentials.tenantCode }
        })

        if (!tenant) {
          return null
        }

        // Find user by email and tenant
        const user = await getPrisma().user.findFirst({
          where: {
            email: credentials.email,
            tenantId: tenant.id
          }
        })

        if (!user || !user.password || !user.tenantId) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantCode: tenant.code,
          tenantName: tenant.name,
        }
      }
    })
  ],
  session: {
    strategy: 'jwt' as const
  },
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: any }) {
      if (user) {
        token.role = user.role
        token.tenantId = user.tenantId
        token.tenantCode = user.tenantCode
        token.tenantName = user.tenantName
      }
      return token
    },
    async session({ session, token }: { session: any; token: JWT }) {
      if (token && session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as string
        session.user.tenantId = token.tenantId as string
        session.user.tenantCode = token.tenantCode as string
        session.user.tenantName = token.tenantName as string
      }
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
  }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }