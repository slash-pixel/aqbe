
import { createMiddleware } from 'hono/factory'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma.js'

const JWT_SECRET = process.env.JWT_SECRET

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    'JWT_SECRET doit être défini et contenir au moins 32 caractères.'
  )
}

export type AdminPayload = {
  id: string
  email: string
  isSuperAdmin: boolean
  tokenVersion: number
}

type AuthVariables = {
  admin: AdminPayload
}

export const adminAuth = createMiddleware<{
  Variables: AuthVariables
}>(async (c, next) => {
  try {
    const authorization = c.req.header('Authorization')

    if (!authorization?.startsWith('Bearer ')) {
      return c.json({ message: 'Authentification requise' }, 401)
    }

    const token = authorization.slice(7)
    const decoded = jwt.verify(token, JWT_SECRET) as AdminPayload

    if (
      !decoded.id ||
      !Number.isInteger(decoded.tokenVersion)
    ) {
      return c.json({ message: 'Token invalide' }, 401)
    }

    const account = await prisma.admin.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        isSuperAdmin: true,
        isActive: true,
        tokenVersion: true
      }
    })

    if (!account || !account.isActive) {
      return c.json({
        message: 'Compte administrateur inexistant ou révoqué'
      }, 401)
    }

    // Refuser les anciens jetons après changement de version.
    if (decoded.tokenVersion !== account.tokenVersion) {
      return c.json({
        message: 'Session expirée. Veuillez vous reconnecter.'
      }, 401)
    }

    c.set('admin', {
      id: account.id,
      email: account.email,
      isSuperAdmin: account.isSuperAdmin,
      tokenVersion: account.tokenVersion
    })

    await next()
  } catch {
    return c.json({
      message: 'Token invalide ou expiré'
    }, 401)
  }
})

export const superAdminOnly = createMiddleware<{
  Variables: AuthVariables
}>(async (c, next) => {
  const admin = c.get('admin')

  if (!admin.isSuperAdmin) {
    return c.json({
      message: 'Accès réservé au Super Admin'
    }, 403)
  }

  await next()
})
