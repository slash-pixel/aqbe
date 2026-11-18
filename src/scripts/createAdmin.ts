
import bcrypt from 'bcrypt'
import { prisma } from '../lib/prisma.js'

const SALT_ROUNDS = 12

async function createFirstAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans .env'
    )
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Adresse email invalide')
  }

  if (password.length < 8) {
    throw new Error('Le mot de passe doit contenir au moins 8 caractères')
  }

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS)

  await prisma.$transaction(
    async (tx) => {
await tx.$queryRaw`
  SELECT pg_advisory_xact_lock(827364921)::text
`

      const adminCount = await tx.admin.count()

      if (adminCount > 0) {
        throw new Error(
          'Un administrateur existe déjà. Création initiale refusée.'
        )
      }

      await tx.admin.create({
        data: {
          email,
          password: hashedPassword,
          isSuperAdmin: true,
          isActive: true,
          createdById: null
        }
      })
    },
    {
      maxWait: 15000,
      timeout: 30000
    }
  )

  console.log('Super Admin créé avec succès.')
  console.log(`Email : ${email}`)
}

createFirstAdmin()
  .catch((error: unknown) => {
    console.error(
      '[Create Admin]',
      error instanceof Error ? error.message : error
    )
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
