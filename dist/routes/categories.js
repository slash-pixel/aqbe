import { Hono } from 'hono';
import { prisma } from '../lib/prisma.js';
const categories = new Hono();
// Lister toutes les catégories
categories.get('/', async (c) => {
    try {
        const result = await prisma.eventCategory.findMany({
            orderBy: { name: 'asc' }
        });
        return c.json(result);
    }
    catch (error) {
        console.error('Erreur chargement catégories :', error);
        return c.json({ message: 'Erreur lors du chargement des catégories' }, 500);
    }
});
// Créer une catégorie
categories.post('/', async (c) => {
    try {
        const body = await c.req.json();
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const description = typeof body.description === 'string'
            ? body.description.trim() || null
            : null;
        if (!name) {
            return c.json({ message: 'Le nom de la catégorie est obligatoire' }, 400);
        }
        const category = await prisma.eventCategory.create({
            data: { name, description }
        });
        return c.json(category, 201);
    }
    catch (error) {
        console.error('Erreur création catégorie :', error);
        return c.json({
            message: 'Impossible de créer la catégorie. Vérifie si elle existe déjà.'
        }, 400);
    }
});
// Modifier une catégorie
categories.patch('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        const body = await c.req.json();
        const data = {};
        if (body.name !== undefined) {
            if (typeof body.name !== 'string' || !body.name.trim()) {
                return c.json({ message: 'Nom de catégorie invalide' }, 400);
            }
            data.name = body.name.trim();
        }
        if (body.description !== undefined) {
            if (body.description !== null &&
                typeof body.description !== 'string') {
                return c.json({ message: 'Description de catégorie invalide' }, 400);
            }
            data.description =
                typeof body.description === 'string'
                    ? body.description.trim() || null
                    : null;
        }
        if (Object.keys(data).length === 0) {
            return c.json({ message: 'Aucune modification fournie' }, 400);
        }
        const category = await prisma.eventCategory.update({
            where: { id },
            data
        });
        return c.json(category);
    }
    catch (error) {
        console.error('Erreur modification catégorie :', error);
        return c.json({ message: 'Catégorie introuvable ou modification impossible' }, 400);
    }
});
// Supprimer une catégorie
categories.delete('/:id', async (c) => {
    try {
        const id = c.req.param('id');
        await prisma.eventCategory.delete({
            where: { id }
        });
        return c.json({ message: 'Catégorie supprimée' });
    }
    catch (error) {
        console.error('Erreur suppression catégorie :', error);
        return c.json({
            message: 'Suppression impossible : vérifie si des événements utilisent cette catégorie.'
        }, 400);
    }
});
export default categories;
