
import { serve } from '@hono/node-server'
import { Hono } from 'hono'

import eventOccurrences from './routes/eventOccurrences.js'
import { startEventScheduler } from './services/eventScheduler.js'
import events from './routes/events.js'
import categories from './routes/categories.js'

const app = new Hono()

// Route principale
app.get('/', (c) => {
  return c.json({
    message: 'API de gestion des événements opérationnelle',
    version: '1.0.0'
  })
})

// Vérification du serveur
app.get('/api/health', (c) => {
  return c.json({
    status: 'OK',
    message: 'Le serveur fonctionne'
  })
})

// Routes API
app.route('/api/categories', categories)
app.route('/api/events', events)
app.route('/api/occurrences', eventOccurrences)

// Route inexistante
app.notFound((c) => {
  return c.json(
    { message: 'Route introuvable' },
    404
  )
})

// Gestion globale des erreurs
app.onError((err, c) => {
  console.error('[API Error]', err)

  return c.json(
    { message: 'Erreur interne du serveur' },
    500
  )
})

// Démarrage de la génération automatique des occurrences
startEventScheduler()

// Démarrage du serveur
const port = 3000

serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    console.log(
      `Serveur démarré sur http://localhost:${info.port}`
    )
  }
)
