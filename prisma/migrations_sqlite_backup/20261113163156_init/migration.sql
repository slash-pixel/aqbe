/*
  Warnings:

  - Added the required column `recurrenceDate` to the `EventOccurrence` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventOccurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recurrenceDate" DATETIME NOT NULL,
    "eventId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventOccurrence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EventOccurrence" ("createdAt", "endsAt", "eventId", "id", "startsAt", "status", "updatedAt") SELECT "createdAt", "endsAt", "eventId", "id", "startsAt", "status", "updatedAt" FROM "EventOccurrence";
DROP TABLE "EventOccurrence";
ALTER TABLE "new_EventOccurrence" RENAME TO "EventOccurrence";
CREATE INDEX "EventOccurrence_status_startsAt_idx" ON "EventOccurrence"("status", "startsAt");
CREATE INDEX "EventOccurrence_status_endsAt_idx" ON "EventOccurrence"("status", "endsAt");
CREATE INDEX "EventOccurrence_eventId_startsAt_idx" ON "EventOccurrence"("eventId", "startsAt");
CREATE UNIQUE INDEX "EventOccurrence_eventId_recurrenceDate_key" ON "EventOccurrence"("eventId", "recurrenceDate");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
