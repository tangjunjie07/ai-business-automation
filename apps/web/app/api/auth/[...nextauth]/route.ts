import NextAuth from 'next-auth'
import { JWT } from 'next-auth/jwt'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { config } from 'dotenv'
import { ROUTES, ROLES } from '../../../../config'

config({ path: '.env.local' })

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  adapter: PrismaPg | undefined
  pool: Pool | undefined
}

function getPrisma() {
  if (!globalForPrisma.prisma) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set')
    }
    globalForPrisma.pool = new Pool({ connectionString })
    globalForPrisma.adapter = new PrismaPg(globalForPrisma.pool)
    globalForPrisma.prisma = new PrismaClient({ adapter: globalForPrisma.adapter })
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
        if (!credentials?.email || !credentials?.password) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[AUTH] missing credentials', { email: credentials?.email, tenantCode: credentials?.tenantCode })
          }
          return null
        }

        // システム管理者（テナント不要）
        if (!credentials.tenantCode) {
          if (process.env.NODE_ENV === 'development') {
            console.debug('System admin auth attempt', { email: credentials.email })
          }
          const admin = await getPrisma().user.findFirst({
            where: {
              email: credentials.email,
              role: ROLES.SUPER_ADMIN
            }
          })
          if (!admin || !admin.password) {
            return null
          }
          const isPasswordValid = await bcrypt.compare(credentials.password, admin.password)
          if (!isPasswordValid) {
            return null
          }
          if (process.env.NODE_ENV === 'development') {
            console.debug('Admin authenticated', { email: admin.email, id: admin.id })
          }
          return {
            id: admin.id,
            email: admin.email,
            name: admin.name,
            role: admin.role,
            tenantId: '0',
            tenantCode: '',
            tenantName: '',
          }
        }

        // テナントユーザー
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
    signIn: ROUTES.SIGNIN,
  }
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST }
