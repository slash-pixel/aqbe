const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("OCCURRENCES EXISTANTES :");

  const occurrences = await prisma.$queryRawUnsafe(`
    SELECT id, eventId, startsAt, date(startsAt) AS jour
    FROM EventOccurrence
    ORDER BY startsAt
    LIMIT 30
  `);

  console.log(occurrences);

  console.log("DOUBLONS PAR JOUR :");

  const doublons = await prisma.$queryRawUnsafe(`
    SELECT eventId, date(startsAt) AS jour, COUNT(*) AS total
    FROM EventOccurrence
    GROUP BY eventId, date(startsAt)
    HAVING COUNT(*) > 1
  `);

  console.log(doublons);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
