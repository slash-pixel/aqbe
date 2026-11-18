
import { Hono } from 'hono'
import { prisma } from '../lib/prisma.js'
import { adminAuth } from '../middleware/adminAuth.js'
import {
  generateOccurrences,
  synchronizeFutureOccurrences
} from '../services/eventGenerator.js'

const events = new Hono()

const recurrenceTypes = ['NONE', 'WEEKLY', 'WEEKDAYS', 'DAILY']

function isValidTime(value: unknown): value is string {
  return typeof value === 'string' &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
}

function isValidDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function validWeekdays(value: unknown): boolean {
  if (!Array.isArray(value)) return false

  return value.length > 0 &&
    value.every(day =>
      Number.isInteger(day) && day >= 1 && day <= 7
    ) &&
    new Set(value).size === value.length
}

// Créer un événement (administrateur connecté)
events.post('/', adminAuth, async (c) => {
  try {
    const body = await c.req.json()

    const {
      title,
      description,
      categoryId,
      recurrenceType,
      weekdays,
      recurrenceStart,
      isPermanent,
      recurrenceEnd,
      startTime,
      endTime
    } = body

    if (
      typeof title !== 'string' || !title.trim() ||
      typeof categoryId !== 'string' ||
      !recurrenceTypes.includes(recurrenceType) ||
      typeof isPermanent !== 'boolean' ||
      !isValidTime(startTime) ||
      !isValidTime(endTime) ||
      startTime >= endTime
    ) {
      return c.json({
        message: 'Informations de programmation invalides'
      }, 400)
    }

    const startDate = isValidDate(recurrenceStart)

    if (!startDate) {
      return c.json({ message: 'Date de début invalide' }, 400)
    }

    let endDate: Date | null = null

    if (!isPermanent) {
      endDate = isValidDate(recurrenceEnd)

      if (!endDate || endDate < startDate) {
        return c.json({ message: 'Date de fin invalide' }, 400)
      }
    }

    if (recurrenceType === 'WEEKLY' && !validWeekdays(weekdays)) {
      return c.json({
        message: 'Sélectionne au moins un jour de la semaine'
      }, 400)
    }

    const selectedDays =
      recurrenceType === 'WEEKLY' ? weekdays : []

    const category = await prisma.eventCategory.findUnique({
      where: { id: categoryId }
    })

    if (!category) {
      return c.json({ message: 'Catégorie introuvable' }, 404)
    }

    const event = await prisma.event.create({
      data: {
        title: title.trim(),
        description: typeof description === 'string'
          ? description.trim()
          : null,
        categoryId,
        recurrenceType,
        weekdays: selectedDays.join(','),
        recurrenceStart: startDate,
        isPermanent,
        recurrenceEnd: endDate,
        startTime,
        endTime
      },
      include: {
        category: true
      }
    })

    await generateOccurrences(90)

    return c.json(event, 201)
  } catch (error) {
    console.error(error)

    return c.json({
      message: 'Erreur lors de la création de l’événement'
    }, 500)
  }
})

// Lister les événements (public)
events.get('/', async (c) => {
  try {
    const activeOnly = c.req.query('active')

    const result = await prisma.event.findMany({
      where: activeOnly === 'true'
        ? { isActive: true }
        : undefined,
      include: {
        category: true
      },
      orderBy: {
        recurrenceStart: 'asc'
      }
    })

    return c.json(result)
  } catch (error) {
    console.error(error)

    return c.json({
      message: 'Erreur lors du chargement des événements'
    }, 500)
  }
})

// Calendrier hebdomadaire (public)
events.get('/calendar/week', async (c) => {
  try {
    const dateParam = c.req.query('date')

    const referenceDate = dateParam
      ? new Date(`${dateParam}T12:00:00+01:00`)
      : new Date()

    if (Number.isNaN(referenceDate.getTime())) {
      return c.json({ message: 'Date invalide' }, 400)
    }

    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Douala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(referenceDate)

    const values = Object.fromEntries(
      parts.map(part => [part.type, part.value])
    )

    const localDate = `${values.year}-${values.month}-${values.day}`
    const [year, month, day] = localDate.split('-').map(Number)

    const dateUTC = new Date(Date.UTC(year, month - 1, day))
    const weekday = dateUTC.getUTCDay() || 7

    const monday = new Date(dateUTC)
    monday.setUTCDate(monday.getUTCDate() - weekday + 1)

    const sundayEnd = new Date(monday)
    sundayEnd.setUTCDate(sundayEnd.getUTCDate() + 7)

    const toDoualaDate = (date: Date) =>
      new Date(date.getTime() - 60 * 60 * 1000)

    const start = toDoualaDate(monday)
    const end = toDoualaDate(sundayEnd)

    const occurrences = await prisma.eventOccurrence.findMany({
      where: {
        status: 'SCHEDULED',
        startsAt: {
          gte: start,
          lt: end
        },
        event: {
          isActive: true
        }
      },
      include: {
        event: {
          include: {
            category: true
          }
        }
      },
      orderBy: {
        startsAt: 'asc'
      }
    })

    return c.json({
      weekStart: monday.toISOString().slice(0, 10),
      occurrences
    })
  } catch (error) {
    console.error(error)

    return c.json({
      message: 'Erreur lors du chargement du calendrier'
    }, 500)
  }
})

// Prochaine célébration pour la modale publique
events.get('/next', async (c) => {
  try {
    const now = new Date()

    const occurrence = await prisma.eventOccurrence.findFirst({
      where: {
        status: 'SCHEDULED',
        endsAt: {
          gt: now
        },
        event: {
          isActive: true
        }
      },
      include: {
        event: {
          include: {
            category: true
          }
        }
      },
      orderBy: {
        startsAt: 'asc'
      }
    })

    if (!occurrence) {
      return c.json({
        occurrence: null,
        message: 'Aucun événement à venir'
      })
    }

    const status =
      occurrence.startsAt <= now
        ? 'EN_COURS'
        : 'A_VENIR'

    return c.json({
      occurrence,
      status
    })
  } catch (error) {
    console.error(error)

    return c.json({
      message: 'Erreur lors du chargement du prochain événement'
    }, 500)
  }
})

// Consulter un événement (public)
events.get('/:id', async (c) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: c.req.param('id') },
      include: {
        category: true,
        occurrences: {
          orderBy: { startsAt: 'asc' }
        }
      }
    })

    if (!event) {
      return c.json({ message: 'Événement introuvable' }, 404)
    }

    return c.json(event)
  } catch (error) {
    console.error(error)

    return c.json({
      message: 'Erreur lors de la consultation'
    }, 500)
  }
})

// Modifier un événement (administrateur connecté)
events.patch('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')
    const body = await c.req.json()

    const existing = await prisma.event.findUnique({
      where: { id }
    })

    if (!existing) {
      return c.json({ message: 'Événement introuvable' }, 404)
    }

    const wasInactive = !existing.isActive

    const data: {
      title?: string
      description?: string | null
      categoryId?: string
      recurrenceType?: 'NONE' | 'WEEKLY' | 'WEEKDAYS' | 'DAILY'
      weekdays?: string
      recurrenceStart?: Date
      isPermanent?: boolean
      recurrenceEnd?: Date | null
      startTime?: string
      endTime?: string
      isActive?: boolean
    } = {}

    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || !body.title.trim()) {
        return c.json({ message: 'Titre invalide' }, 400)
      }

      data.title = body.title.trim()
    }

    if (body.description !== undefined) {
      data.description = typeof body.description === 'string'
        ? body.description.trim()
        : null
    }

    if (body.isActive !== undefined) {
      if (typeof body.isActive !== 'boolean') {
        return c.json({ message: 'Statut invalide' }, 400)
      }

      data.isActive = body.isActive
    }

    if (body.categoryId !== undefined) {
      if (typeof body.categoryId !== 'string') {
        return c.json({ message: 'Catégorie invalide' }, 400)
      }

      const category = await prisma.eventCategory.findUnique({
        where: { id: body.categoryId }
      })

      if (!category) {
        return c.json({ message: 'Catégorie introuvable' }, 404)
      }

      data.categoryId = body.categoryId
    }

    if (body.recurrenceType !== undefined) {
      if (!recurrenceTypes.includes(body.recurrenceType)) {
        return c.json({
          message: 'Type de répétition invalide'
        }, 400)
      }

      data.recurrenceType = body.recurrenceType
    }

    const type = data.recurrenceType ?? existing.recurrenceType

    if (type === 'WEEKLY') {
      if (body.weekdays !== undefined) {
        if (!validWeekdays(body.weekdays)) {
          return c.json({
            message: 'Jours de répétition invalides'
          }, 400)
        }

        data.weekdays = body.weekdays.join(',')
      } else if (existing.recurrenceType !== 'WEEKLY') {
        return c.json({
          message: 'Sélectionne au moins un jour de la semaine'
        }, 400)
      }
    } else {
      data.weekdays = ''
    }

    if (body.recurrenceStart !== undefined) {
      const date = isValidDate(body.recurrenceStart)

      if (!date) {
        return c.json({ message: 'Date de début invalide' }, 400)
      }

      data.recurrenceStart = date
    }

    if (body.isPermanent !== undefined) {
      if (typeof body.isPermanent !== 'boolean') {
        return c.json({
          message: 'Valeur de programmation permanente invalide'
        }, 400)
      }

      data.isPermanent = body.isPermanent
    }

    const permanent = data.isPermanent ?? existing.isPermanent

    if (permanent) {
      data.recurrenceEnd = null
    } else if (body.recurrenceEnd !== undefined) {
      const date = isValidDate(body.recurrenceEnd)

      if (!date) {
        return c.json({ message: 'Date de fin invalide' }, 400)
      }

      data.recurrenceEnd = date
    }

    if (body.startTime !== undefined) {
      if (!isValidTime(body.startTime)) {
        return c.json({ message: 'Heure de début invalide' }, 400)
      }

      data.startTime = body.startTime
    }

    if (body.endTime !== undefined) {
      if (!isValidTime(body.endTime)) {
        return c.json({ message: 'Heure de fin invalide' }, 400)
      }

      data.endTime = body.endTime
    }

    const startTime = data.startTime ?? existing.startTime
    const endTime = data.endTime ?? existing.endTime

    if (startTime >= endTime) {
      return c.json({
        message: 'L’heure de fin doit être après l’heure de début'
      }, 400)
    }

    const startDate = data.recurrenceStart ?? existing.recurrenceStart

    const endDate = data.recurrenceEnd !== undefined
      ? data.recurrenceEnd
      : existing.recurrenceEnd

    if (!permanent && (!endDate || endDate < startDate)) {
      return c.json({ message: 'Date de fin invalide' }, 400)
    }

    const scheduleChanged = [
      'recurrenceType',
      'weekdays',
      'recurrenceStart',
      'isPermanent',
      'recurrenceEnd',
      'startTime',
      'endTime'
    ].some(key => body[key] !== undefined)

    const updated = await prisma.event.update({
      where: { id },
      data,
      include: {
        category: true
      }
    })

    if (scheduleChanged) {
      await synchronizeFutureOccurrences(id, updated)

      if (updated.isActive) {
        await generateOccurrences(90)
      }
    } else if (wasInactive && updated.isActive) {
      await generateOccurrences(90)
    }

    return c.json(updated)
  } catch (error) {
    console.error(error)

    return c.json({
      message: 'Erreur lors de la modification'
    }, 500)
  }
})

// Suspendre une programmation sans supprimer ses occurrences (administrateur connecté)
events.delete('/:id', adminAuth, async (c) => {
  try {
    const id = c.req.param('id')

    const event = await prisma.event.findUnique({
      where: { id }
    })

    if (!event) {
      return c.json({ message: 'Événement introuvable' }, 404)
    }

    if (!event.isActive) {
      return c.json({
        message: 'Cette programmation est déjà suspendue'
      }, 400)
    }

    await prisma.event.update({
      where: { id },
      data: {
        isActive: false
      }
    })

    return c.json({
      message: 'Programmation suspendue. Historique conservé.'
    })
  } catch (error) {
    console.error(error)

    return c.json({
      message: 'Erreur lors de la suspension de la programmation'
    }, 500)
  }
})

export default events
