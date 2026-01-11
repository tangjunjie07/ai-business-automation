import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: './prisma/schema.prisma',
  url: process.env.DATABASE_URL,
  migrations: {
    seed: 'node ./prisma/seed.ts',
  },
})
