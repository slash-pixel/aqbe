
import { Hono } from 'hono'
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

import { prisma } from '../lib/prisma.js'
import {
  adminAuth,
  superAdminOnly,
  type AdminPayload
} from '../middleware/adminAuth.js'

const admin = new Hono<{
  Variables: {
    admin: AdminPayload
  }
}>()

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET doit contenir au moins 32 caractères.')
}

const SALT_ROUNDS = 12
const PASSWORD_MIN_LENGTH = 8

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function isUniqueError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}

// =====================================================
// CONNEXION
// =====================================================

admin.post('/login', async (c) => {
  try {
    const body = await c.req.json()

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : ''

    const password =
      typeof body.password === 'string'
        ? body.password
        : ''

    if (!email || !password) {
      return c.json({
        message: 'Email et mot de passe obligatoires'
      }, 400)
    }

    const account = await prisma.admin.findUnique({
      where: { email }
    })

    if (!account || !account.isActive) {
      return c.json({
        message: 'Email ou mot de passe incorrect'
      }, 401)
    }

    const passwordValid = await bcrypt.compare(
      password,
      account.password
    )

    if (!passwordValid) {
      return c.json({
        message: 'Email ou mot de passe incorrect'
      }, 401)
    }

    const token = jwt.sign(
      {
        id: account.id,
        tokenVersion: account.tokenVersion
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    )

    return c.json({
      message: 'Connexion réussie',
      token,
      admin: {
        id: account.id,
        email: account.email,
        isSuperAdmin: account.isSuperAdmin
      }
    })

  } catch (error) {
    console.error('[Admin Login]', error)

    return c.json({
      message: 'Erreur lors de la connexion'
    }, 500)
  }
})

// =====================================================
// PROFIL DE L'ADMINISTRATEUR CONNECTÉ
// =====================================================

admin.get('/me', adminAuth, async (c) => {
  try {
    const currentAdmin = c.get('admin')

    const account = await prisma.admin.findUnique({
      where: { id: currentAdmin.id },
      select: {
        id: true,
        email: true,
        isSuperAdmin: true,
        isActive: true,
        createdAt: true,
        updatedAt: true
      }
    })

    if (!account) {
      return c.json({
        message: 'Administrateur introuvable'
      }, 404)
    }

    return c.json({ admin: account })

  } catch (error) {
    console.error('[Admin Me]', error)

    return c.json({
      message: 'Erreur lors de la récupération du profil'
    }, 500)
  }
})

// =====================================================
// MODIFICATION DE SON PROPRE PROFIL
// =====================================================

admin.patch('/profile', adminAuth, async (c) => {
  try {
    const currentAdmin = c.get('admin')
    const body = await c.req.json()

    const currentPassword =
      typeof body.currentPassword === 'string'
        ? body.currentPassword
        : ''

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : undefined

    const newPassword =
      typeof body.password === 'string'
        ? body.password
        : undefined

    if (!currentPassword) {
      return c.json({
        message: 'Le mot de passe actuel est obligatoire'
      }, 400)
    }

    if (email === undefined && newPassword === undefined) {
      return c.json({
        message: 'Aucune modification fournie'
      }, 400)
    }

    if (email !== undefined && !isValidEmail(email)) {
      return c.json({
        message: 'Adresse email invalide'
      }, 400)
    }

    if (
      newPassword !== undefined &&
      newPassword.length < PASSWORD_MIN_LENGTH
    ) {
      return c.json({
        message: `Le nouveau mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`
      }, 400)
    }

    const account = await prisma.admin.findUnique({
      where: { id: currentAdmin.id }
    })

    if (!account || !account.isActive) {
      return c.json({
        message: 'Compte administrateur introuvable ou désactivé'
      }, 401)
    }

    const passwordValid = await bcrypt.compare(
      currentPassword,
      account.password
    )

    if (!passwordValid) {
      return c.json({
        message: 'Mot de passe actuel incorrect'
      }, 401)
    }

    const data: {
      email?: string
      password?: string
      tokenVersion?: { increment: number }
    } = {}

    if (email !== undefined) {
      data.email = email
    }

    if (newPassword !== undefined) {
      data.password = await bcrypt.hash(
        newPassword,
        SALT_ROUNDS
      )

      data.tokenVersion = { increment: 1 }
    }

    const updated = await prisma.admin.update({
      where: { id: account.id },
      data,
      select: {
        id: true,
        email: true,
        isSuperAdmin: true,
        isActive: true,
        updatedAt: true
      }
    })

    return c.json({
      message: newPassword !== undefined
        ? 'Profil modifié avec succès. Veuillez vous reconnecter.'
        : 'Profil modifié avec succès',
      admin: updated,
      requiresLogin: newPassword !== undefined
    })

  } catch (error) {
    if (isUniqueError(error)) {
      return c.json({
        message: 'Cette adresse email est déjà utilisée'
      }, 409)
    }

    console.error('[Admin Profile]', error)

    return c.json({
      message: 'Erreur lors de la modification du profil'
    }, 500)
  }
})

// =====================================================
// LISTE DES ADMINISTRATEURS
// SUPER ADMIN UNIQUEMENT
// =====================================================

admin.get('/admins', adminAuth, superAdminOnly, async (c) => {
  try {
    const accounts = await prisma.admin.findMany({
      select: {
        id: true,
        email: true,
        isSuperAdmin: true,
        isActive: true,
        createdById: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    return c.json({
      total: accounts.length,
      admins: accounts
    })

  } catch (error) {
    console.error('[Admin List]', error)

    return c.json({
      message: 'Erreur lors de la récupération des administrateurs'
    }, 500)
  }
})

// =====================================================
// CRÉATION D'UN ADMINISTRATEUR
// SUPER ADMIN UNIQUEMENT
// =====================================================

admin.post('/admins', adminAuth, superAdminOnly, async (c) => {
  try {
    const currentAdmin = c.get('admin')
    const body = await c.req.json()

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : ''

    const password =
      typeof body.password === 'string'
        ? body.password
        : ''

    if (!email || !password) {
      return c.json({
        message: 'Email et mot de passe obligatoires'
      }, 400)
    }

    if (!isValidEmail(email)) {
      return c.json({
        message: 'Adresse email invalide'
      }, 400)
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      return c.json({
        message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`
      }, 400)
    }

    const hashedPassword = await bcrypt.hash(
      password,
      SALT_ROUNDS
    )

    const created = await prisma.admin.create({
      data: {
        email,
        password: hashedPassword,
        isSuperAdmin: false,
        isActive: true,
        createdById: currentAdmin.id
      },
      select: {
        id: true,
        email: true,
        isSuperAdmin: true,
        isActive: true,
        createdById: true,
        createdAt: true
      }
    })

    return c.json({
      message: 'Administrateur créé avec succès',
      admin: created
    }, 201)

  } catch (error) {
    if (isUniqueError(error)) {
      return c.json({
        message: 'Cette adresse email est déjà utilisée'
      }, 409)
    }

    console.error('[Admin Create]', error)

    return c.json({
      message: 'Erreur lors de la création de l’administrateur'
    }, 500)
  }
})

// =====================================================
// MODIFICATION D'UN AUTRE ADMINISTRATEUR
// SUPER ADMIN UNIQUEMENT
// =====================================================

admin.patch('/admins/:id', adminAuth, superAdminOnly, async (c) => {
  try {
    const currentAdmin = c.get('admin')
    const id = c.req.param('id')
    const body = await c.req.json()

    if (id === currentAdmin.id) {
      return c.json({
        message: 'Utilisez la route /profile pour modifier votre compte'
      }, 400)
    }

    const target = await prisma.admin.findUnique({
      where: { id }
    })

    if (!target) {
      return c.json({
        message: 'Administrateur introuvable'
      }, 404)
    }

    if (target.isSuperAdmin) {
      return c.json({
        message: 'Le compte Super Admin principal est protégé'
      }, 403)
    }

    const email =
      typeof body.email === 'string'
        ? body.email.trim().toLowerCase()
        : undefined

    const password =
      typeof body.password === 'string'
        ? body.password
        : undefined

    if (email === undefined && password === undefined) {
      return c.json({
        message: 'Aucune modification fournie'
      }, 400)
    }

    if (email !== undefined && !isValidEmail(email)) {
      return c.json({
        message: 'Adresse email invalide'
      }, 400)
    }

    if (
      password !== undefined &&
      password.length < PASSWORD_MIN_LENGTH
    ) {
      return c.json({
        message: `Le mot de passe doit contenir au moins ${PASSWORD_MIN_LENGTH} caractères`
      }, 400)
    }

    const data: {
      email?: string
      password?: string
      tokenVersion?: { increment: number }
    } = {}

    if (email !== undefined) {
      data.email = email
    }

    if (password !== undefined) {
      data.password = await bcrypt.hash(
        password,
        SALT_ROUNDS
      )

      data.tokenVersion = { increment: 1 }
    }

    const updated = await prisma.admin.update({
      where: { id },
      data,
      select: {
        id: true,
        email: true,
        isSuperAdmin: true,
        isActive: true,
        updatedAt: true
      }
    })

    return c.json({
      message: 'Administrateur modifié avec succès',
      admin: updated
    })

  } catch (error) {
    if (isUniqueError(error)) {
      return c.json({
        message: 'Cette adresse email est déjà utilisée'
      }, 409)
    }

    console.error('[Admin Update]', error)

    return c.json({
      message: 'Erreur lors de la modification de l’administrateur'
    }, 500)
  }
})

// =====================================================
// RÉVOCATION D'UN ADMINISTRATEUR
// SUPER ADMIN UNIQUEMENT
// =====================================================

admin.patch('/admins/:id/revoke', adminAuth, superAdminOnly, async (c) => {
  try {
    const currentAdmin = c.get('admin')
    const id = c.req.param('id')

    if (id === currentAdmin.id) {
      return c.json({
        message: 'Vous ne pouvez pas révoquer votre propre compte'
      }, 403)
    }

    const target = await prisma.admin.findUnique({
      where: { id }
    })

    if (!target) {
      return c.json({
        message: 'Administrateur introuvable'
      }, 404)
    }

    if (target.isSuperAdmin) {
      return c.json({
        message: 'Le Super Admin principal ne peut pas être révoqué'
      }, 403)
    }

    if (!target.isActive) {
      return c.json({
        message: 'Cet administrateur est déjà révoqué'
      }, 400)
    }

    await prisma.admin.update({
      where: { id },
      data: {
        isActive: false,
        tokenVersion: { increment: 1 }
      }
    })

    return c.json({
      message: 'Administrateur révoqué avec succès'
    })

  } catch (error) {
    console.error('[Admin Revoke]', error)

    return c.json({
      message: 'Erreur lors de la révocation'
    }, 500)
  }
})

// =====================================================
// RÉACTIVATION D'UN ADMINISTRATEUR
// SUPER ADMIN UNIQUEMENT
// =====================================================

admin.patch('/admins/:id/restore', adminAuth, superAdminOnly, async (c) => {
  try {
    const id = c.req.param('id')

    const target = await prisma.admin.findUnique({
      where: { id }
    })

    if (!target) {
      return c.json({
        message: 'Administrateur introuvable'
      }, 404)
    }

    if (target.isSuperAdmin) {
      return c.json({
        message: 'Le Super Admin principal ne nécessite pas de réactivation'
      }, 400)
    }

    if (target.isActive) {
      return c.json({
        message: 'Cet administrateur est déjà actif'
      }, 400)
    }

    await prisma.admin.update({
      where: { id },
      data: {
        isActive: true,
        tokenVersion: { increment: 1 }
      }
    })

    return c.json({
      message: 'Administrateur réactivé avec succès'
    })

  } catch (error) {
    console.error('[Admin Restore]', error)

    return c.json({
      message: 'Erreur lors de la réactivation'
    }, 500)
  }
})

export default admin
