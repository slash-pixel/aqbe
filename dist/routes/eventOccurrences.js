import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
const eventOccurrences = new Hono();
// Consulter une occurrence
eventOccurrences.get('/:id', async (c) => {
    try {
        const occurrence = await prisma.eventOccurrence.findUnique({
            where: {
                id: c.req.param('id')
            },
            include: {
                event: {
                    include: {
                        category: true
                    }
                }
            }
        });
        if (!occurrence) {
            return c.json({ message: 'Occurrence introuvable' }, 404);
        }
        return c.json(occurrence);
    }
    catch (error) {
        console.error(error);
        return c.json({
            message: 'Erreur lors de la consultation de l’occurrence'
        }, 500);
    }
});
// Décaler une seule occurrence de 7 jours
eventOccurrences.patch('/:id/shift-seven-days', async (c) => {
    try {
        const id = c.req.param('id');
        const now = new Date();
        const occurrence = await prisma.eventOccurrence.findUnique({
            where: { id },
            include: {
                event: true
            }
        });
        if (!occurrence) {
            return c.json({ message: 'Occurrence introuvable' }, 404);
        }
        if (occurrence.status !== 'SCHEDULED') {
            return c.json({
                message: 'Seules les occurrences programmées peuvent être déplacées'
            }, 400);
        }
        if (!occurrence.event.isActive) {
            return c.json({
                message: 'Impossible de déplacer une occurrence d’une programmation suspendue'
            }, 400);
        }
        if (occurrence.startsAt <= now) {
            return c.json({
                message: 'Impossible de déplacer une occurrence déjà commencée'
            }, 400);
        }
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        const newStartsAt = new Date(occurrence.startsAt.getTime() + sevenDays);
        const newEndsAt = new Date(occurrence.endsAt.getTime() + sevenDays);
        // Vérifier tout chevauchement avec une autre occurrence du même événement.
        const conflict = await prisma.eventOccurrence.findFirst({
            where: {
                eventId: occurrence.eventId,
                id: { not: id },
                status: 'SCHEDULED',
                startsAt: { lt: newEndsAt },
                endsAt: { gt: newStartsAt }
            }
        });
        if (conflict) {
            return c.json({
                message: 'Une autre occurrence chevauche la nouvelle période choisie'
            }, 409);
        }
        const updated = await prisma.eventOccurrence.update({
            where: { id },
            data: {
                startsAt: newStartsAt,
                endsAt: newEndsAt
            },
            include: {
                event: {
                    include: {
                        category: true
                    }
                }
            }
        });
        return c.json({
            message: 'Occurrence déplacée de 7 jours avec succès',
            occurrence: updated
        });
    }
    catch (error) {
        console.error(error);
        return c.json({
            message: 'Erreur lors du déplacement de l’occurrence'
        }, 500);
    }
});
// Annuler une seule occurrence sans supprimer son historique
eventOccurrences.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const occurrence = await prisma.eventOccurrence.findUnique({
            where: { id }
        });
        if (!occurrence) {
            return c.json({ message: 'Occurrence introuvable' }, 404);
        }
        if (occurrence.status === 'CANCELLED') {
            return c.json({
                message: 'Cette occurrence est déjà annulée'
            }, 400);
        }
        const updated = await prisma.eventOccurrence.update({
            where: { id },
            data: {
                status: 'CANCELLED'
            },
            include: {
                event: {
                    include: {
                        category: true
                    }
                }
            }
        });
        return c.json({
            message: 'Occurrence annulée. Historique conservé.',
            occurrence: updated
        });
    }
    catch (error) {
        console.error(error);
        return c.json({
            message: 'Erreur lors de l’annulation de l’occurrence'
        }, 500);
    }
});
export default eventOccurrences;
