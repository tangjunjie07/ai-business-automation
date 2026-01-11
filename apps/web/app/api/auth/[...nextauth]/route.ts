import NextAuth, { type Session } from 'next-auth'
import { JWT } from 'next-auth/jwt'
import { PrismaClient } from '@prisma/client'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL
const pool = new Pool({ connectionString })
const adapter = new PrismaPg(pool)

const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        tenantCode: { label: 'Tenant Code', type: 'text', required: false }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        let user;

        if (credentials.tenantCode) {
          // Regular user/admin login with tenant
          const tenant = await prisma.tenant.findFirst({
            where: { code: credentials.tenantCode }
          })

          if (!tenant) {
            return null
          }

          user = await prisma.user.findUnique({
            where: { 
              email: credentials.email,
              tenantId: tenant.id
            },
            select: { id: true, email: true, name: true, role: true, password: true, tenantId: true }
          })
        } else {
          // Super admin login (no tenant)
          user = await prisma.user.findUnique({
            where: { 
              email: credentials.email,
              tenantId: null
            },
            select: { id: true, email: true, name: true, role: true, password: true, tenantId: true }
          })
        }

        if (!user || !user.password) {
          return null
        }

        // Hash and compare passwords
        const isValidPassword = await bcrypt.compare(credentials.password, user.password)
        if (!isValidPassword) {
          return null
        }

        const { password, ...userWithoutPassword } = user
        return {
          ...userWithoutPassword,
          role: user.role,
          tenantId: user.tenantId
        }
      }
    })
  ],
  session: {
    strategy: 'jwt' as const
  },
  callbacks: {
    jwt: async ({ token, user }: { token: JWT; user?: any }) => {
      if (user) {
        token.role = user.role
        token.tenantId = user.tenantId
      }
      return token
    },
    session: async ({ session, token }: { session: Session; token: JWT }) => {
      session.user.role = token.role as string
      session.user.tenantId = token.tenantId as string
      return session
    }
  },
  pages: {
    signIn: '/auth/signin',
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST, authOptions }