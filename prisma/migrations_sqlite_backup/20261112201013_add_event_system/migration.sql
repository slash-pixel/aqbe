-- CreateTable
CREATE TABLE "EventCategory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "recurrenceType" TEXT NOT NULL DEFAULT 'NONE',
    "weekdays" TEXT NOT NULL DEFAULT '',
    "recurrenceStart" DATETIME NOT NULL,
    "isPermanent" BOOLEAN NOT NULL DEFAULT true,
    "recurrenceEnd" DATETIME,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EventOccurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eventId" TEXT NOT NULL,
    "startsAt" DATETIME NOT NULL,
    "endsAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventOccurrence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "EventCategory_name_key" ON "EventCategory"("name");

-- CreateIndex
CREATE INDEX "Event_categoryId_isActive_idx" ON "Event"("categoryId", "isActive");

-- CreateIndex
CREATE INDEX "Event_isActive_recurrenceType_idx" ON "Event"("isActive", "recurrenceType");

-- CreateIndex
CREATE INDEX "EventOccurrence_status_startsAt_idx" ON "EventOccurrence"("status", "startsAt");

-- CreateIndex
CREATE INDEX "EventOccurrence_status_endsAt_idx" ON "EventOccurrence"("status", "endsAt");

-- CreateIndex
CREATE INDEX "EventOccurrence_eventId_startsAt_idx" ON "EventOccurrence"("eventId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "EventOccurrence_eventId_startsAt_key" ON "EventOccurrence"("eventId", "startsAt");
