
import { Hono } from 'hono'
import { prisma } from '../lib/prisma.js'
import { adminAuth } from '../middleware/adminAuth.js'

const categories = new Hono()

// Lister toutes les catégories (public)
categories.get('/', async (c) => {
  try {
    const result = await prisma.eventCategory.findMany({
      orderBy: {
        name: 'asc'
      }
    })

    return c.json(result)
  } catch (error) {
    console.error('[GET CATEGORIES]', error)
    return c.json({ message: 'Erreur lors de la récupération des catégories' }, 500)
  }
})

// Créer une catégorie (admin connecté)
categories.post('/', adminAuth, async (c) => {
  try {
    const body = await c.req.json()
    const name = String(body.name ?? '').trim()
    const description = body.description
      ? String(body.description).trim()
      : null

    if (!name) {
      return c.json({ message: 'Le nom de la catégorie est obligatoire' }, 400)
    }

    const category = await prisma.eventCategory.create({
      data: {
        name,
        description
      }
    })

    return c.json(category, 201)
  } catch (error: any) {
    if (error.code === 'P2002') {
      return c.json({ message: 'Cette catégorie existe déjà' }, 409)
    }

    console.error('[POST CATEGORY]', error)
    return c.json({ message: 'Erreur lors de la création de la catégorie' }, 500)
  }
})

// Modifier une catégorie (admin connecté)
categories.patch('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()

    const data: {
      name?: string
      description?: string | null
    } = {}

    if (body.name !== undefined) {
      const name = String(body.name).trim()

      if (!name) {
        return c.json({ message: 'Le nom de la catégorie est obligatoire' }, 400)
      }

      data.name = name
    }

    if (body.description !== undefined) {
      data.description = body.description
        ? String(body.description).trim()
        : null
    }

    if (Object.keys(data).length === 0) {
      return c.json({ message: 'Aucune modification fournie' }, 400)
    }

    const category = await prisma.eventCategory.update({
      where: { id },
      data
    })

    return c.json(category)
  } catch (error: any) {
    if (error.code === 'P2025') {
      return c.json({ message: 'Catégorie introuvable' }, 404)
    }

    if (error.code === 'P2002') {
      return c.json({ message: 'Cette catégorie existe déjà' }, 409)
    }

    console.error('[PATCH CATEGORY]', error)
    return c.json({ message: 'Erreur lors de la modification de la catégorie' }, 500)
  }
})

// Supprimer une catégorie (admin connecté)
categories.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')

    await prisma.eventCategory.delete({
      where: { id }
    })

    return c.json({ message: 'Catégorie supprimée avec succès' })
  } catch (error: any) {
    if (error.code === 'P2025') {
      return c.json({ message: 'Catégorie introuvable' }, 404)
    }

    if (error.code === 'P2003') {
      return c.json({
        message: 'Impossible de supprimer cette catégorie car elle est utilisée par des événements'
      }, 409)
    }

    console.error('[DELETE CATEGORY]', error)
    return c.json({ message: 'Erreur lors de la suppression de la catégorie' }, 500)
  }
})

export default categories
