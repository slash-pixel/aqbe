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
    CONSTRAINT "EventOccurrence_eventId_fkey"
      FOREIGN KEY ("eventId") REFERENCES "Event" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE
);

DROP TABLE "EventOccurrence";
ALTER TABLE "new_EventOccurrence" RENAME TO "EventOccurrence";

CREATE INDEX "EventOccurrence_status_startsAt_idx"
ON "EventOccurrence"("status", "startsAt");

CREATE INDEX "EventOccurrence_status_endsAt_idx"
ON "EventOccurrence"("status", "endsAt");

CREATE INDEX "EventOccurrence_eventId_startsAt_idx"
ON "EventOccurrence"("eventId", "startsAt");

CREATE UNIQUE INDEX "EventOccurrence_eventId_recurrenceDate_key"
ON "EventOccurrence"("eventId", "recurrenceDate");

PRAGMA foreign_keys=ON;
