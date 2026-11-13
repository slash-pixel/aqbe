import { generateOccurrences } from './eventGenerator.js';
const GENERATION_INTERVAL = 24 * 60 * 60 * 1000;
const GENERATION_HORIZON = 90;
let schedulerStarted = false;
let generationRunning = false;
export function startEventScheduler() {
    if (schedulerStarted)
        return;
    schedulerStarted = true;
    const runGeneration = async () => {
        if (generationRunning) {
            console.log('[EventScheduler] Une génération est déjà en cours.');
            return;
        }
        generationRunning = true;
        try {
            const result = await generateOccurrences(GENERATION_HORIZON);
            console.log(`[EventScheduler] Génération terminée : ${result.generated} occurrence(s) créée(s).`);
        }
        catch (error) {
            console.error('[EventScheduler] Erreur lors de la génération des occurrences :', error);
        }
        finally {
            generationRunning = false;
        }
    };
    // Génération dès le démarrage du serveur
    void runGeneration();
    // Renouvellement automatique toutes les 24 heures
    setInterval(() => {
        void runGeneration();
    }, GENERATION_INTERVAL);
    console.log('[EventScheduler] Génération automatique activée.');
}
