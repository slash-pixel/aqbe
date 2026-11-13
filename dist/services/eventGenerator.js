import { prisma } from '../lib/prisma.js';
const TIME_ZONE = 'Africa/Douala';
const DOUALA_UTC_OFFSET = 60;
// Récupérer la date locale au Cameroun
function getLocalDate(date) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}
// Décomposer une date YYYY-MM-DD
function parseDate(value) {
    const [year, month, day] = value.split('-').map(Number);
    return { year, month, day };
}
// Ajouter des jours à une date
function addDays(value, amount) {
    const { year, month, day } = parseDate(value);
    return new Date(Date.UTC(year, month - 1, day + amount)).toISOString().slice(0, 10);
}
// Obtenir le jour de la semaine : lundi = 1, dimanche = 7
function getWeekday(value) {
    const { year, month, day } = parseDate(value);
    const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    return weekday === 0 ? 7 : weekday;
}
// Créer une date réelle avec le fuseau horaire de Douala
function createDoualaDate(value, time) {
    const { year, month, day } = parseDate(value);
    const [hours, minutes] = time.split(':').map(Number);
    return new Date(Date.UTC(year, month - 1, day, hours, minutes) -
        DOUALA_UTC_OFFSET * 60 * 1000);
}
// Clé de date initialement programmée
function createRecurrenceDate(value) {
    return new Date(`${value}T00:00:00.000Z`);
}
// Vérifier si une date correspond à la programmation
function matchesRecurrence(recurrenceType, weekdays, date) {
    const weekday = getWeekday(date);
    switch (recurrenceType) {
        case 'NONE':
        case 'DAILY':
            return true;
        case 'WEEKDAYS':
            return weekday >= 1 && weekday <= 5;
        case 'WEEKLY': {
            const selectedDays = weekdays
                .split(',')
                .map(Number)
                .filter(day => Number.isInteger(day) && day >= 1 && day <= 7);
            return selectedDays.includes(weekday);
        }
        default:
            return false;
    }
}
// Générer progressivement les occurrences futures
export async function generateOccurrences(days = 90) {
    if (!Number.isInteger(days) || days < 1) {
        throw new Error('Le nombre de jours doit être un entier positif.');
    }
    const today = getLocalDate(new Date());
    const rangeEnd = addDays(today, days);
    const events = await prisma.event.findMany({
        where: {
            isActive: true
        }
    });
    let generated = 0;
    for (const event of events) {
        const recurrenceStart = getLocalDate(event.recurrenceStart);
        const recurrenceEnd = !event.isPermanent && event.recurrenceEnd
            ? getLocalDate(event.recurrenceEnd)
            : null;
        const firstDate = recurrenceStart > today ? recurrenceStart : today;
        const lastDate = recurrenceEnd && recurrenceEnd < rangeEnd
            ? recurrenceEnd
            : rangeEnd;
        if (firstDate >= rangeEnd || firstDate > lastDate) {
            continue;
        }
        // Une programmation ponctuelle ne produit qu'une occurrence.
        if (event.recurrenceType === 'NONE') {
            if (recurrenceStart < today ||
                recurrenceStart >= rangeEnd ||
                (recurrenceEnd && recurrenceStart > recurrenceEnd)) {
                continue;
            }
        }
        for (let currentDate = firstDate; currentDate < rangeEnd && currentDate <= lastDate; currentDate = addDays(currentDate, 1)) {
            // NONE : uniquement la date initialement programmée.
            if (event.recurrenceType === 'NONE' &&
                currentDate !== recurrenceStart) {
                continue;
            }
            if (!matchesRecurrence(event.recurrenceType, event.weekdays, currentDate)) {
                continue;
            }
            const recurrenceDate = createRecurrenceDate(currentDate);
            // Une occurrence existante ne doit jamais être recréée,
            // même si elle a été annulée ou déplacée.
            const existing = await prisma.eventOccurrence.findUnique({
                where: {
                    eventId_recurrenceDate: {
                        eventId: event.id,
                        recurrenceDate
                    }
                }
            });
            if (existing) {
                continue;
            }
            await prisma.eventOccurrence.create({
                data: {
                    eventId: event.id,
                    recurrenceDate,
                    startsAt: createDoualaDate(currentDate, event.startTime),
                    endsAt: createDoualaDate(currentDate, event.endTime),
                    status: 'SCHEDULED'
                }
            });
            generated++;
        }
    }
    return {
        message: 'Génération des occurrences terminée',
        generated,
        days,
        from: today,
        until: addDays(today, days - 1)
    };
}
// Synchroniser les occurrences futures après modification
// de la programmation d'un événement.
export async function synchronizeFutureOccurrences(eventId, event) {
    const now = new Date();
    const occurrences = await prisma.eventOccurrence.findMany({
        where: {
            eventId,
            status: 'SCHEDULED',
            startsAt: {
                gt: now
            }
        }
    });
    const firstDate = getLocalDate(event.recurrenceStart);
    const lastDate = !event.isPermanent && event.recurrenceEnd
        ? getLocalDate(event.recurrenceEnd)
        : null;
    const selectedDays = event.weekdays
        .split(',')
        .filter(Boolean)
        .map(Number);
    for (const occurrence of occurrences) {
        const date = occurrence.recurrenceDate
            .toISOString()
            .slice(0, 10);
        // Ne pas modifier une occurrence déplacée individuellement.
        if (getLocalDate(occurrence.startsAt) !== date) {
            continue;
        }
        const weekday = getWeekday(date);
        let matches = date >= firstDate &&
            (!lastDate || date <= lastDate);
        switch (event.recurrenceType) {
            case 'NONE':
                matches = matches && date === firstDate;
                break;
            case 'WEEKLY':
                matches = matches && selectedDays.includes(weekday);
                break;
            case 'WEEKDAYS':
                matches = matches && weekday >= 1 && weekday <= 5;
                break;
            case 'DAILY':
                break;
        }
        // Si la date ne correspond plus à la programmation,
        // annuler l'occurrence sans supprimer son historique.
        if (!matches) {
            await prisma.eventOccurrence.update({
                where: {
                    id: occurrence.id
                },
                data: {
                    status: 'CANCELLED'
                }
            });
            continue;
        }
        // Mettre à jour les horaires sans changer la date.
        await prisma.eventOccurrence.update({
            where: {
                id: occurrence.id
            },
            data: {
                startsAt: createDoualaDate(date, event.startTime),
                endsAt: createDoualaDate(date, event.endTime)
            }
        });
    }
}
