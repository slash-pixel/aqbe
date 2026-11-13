-- CreateEnum
CREATE TYPE "RecurrenceType" AS ENUM ('NONE', 'WEEKLY', 'WEEKDAYS', 'DAILY');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateTable
CREATE TABLE "EventCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT NOT NULL,
    "recurrenceType" "RecurrenceType" NOT NULL DEFAULT 'NONE',
    "weekdays" TEXT NOT NULL DEFAULT '',
    "recurrenceStart" TIMESTAMP(3) NOT NULL,
    "isPermanent" BOOLEAN NOT NULL DEFAULT true,
    "recurrenceEnd" TIMESTAMP(3),
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventOccurrence" (
    "id" TEXT NOT NULL,
    "recurrenceDate" TIMESTAMP(3) NOT NULL,
    "eventId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'SCHEDULED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventOccurrence_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "EventOccurrence_eventId_recurrenceDate_key" ON "EventOccurrence"("eventId", "recurrenceDate");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "EventCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventOccurrence" ADD CONSTRAINT "EventOccurrence_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
