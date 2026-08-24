const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data
  await prisma.appointment.deleteMany();
  await prisma.recurrence.deleteMany();
  await prisma.therapistSchedule.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('password123', 10);

  // Create therapist
  const therapist = await prisma.user.create({
    data: {
      id: 'a796de80-4ae7-4591-9158-a4e329e1a1c6',
      email: 'therapist@wysa.com',
      passwordHash,
      name: 'Dr. Sarah Johnson',
      role: 'therapist',
    },
  });

  // Create patients
  const patient1 = await prisma.user.create({
    data: {
      id: 'b193e7b3-877a-4b5a-b677-9ea743351041',
      email: 'patient1@wysa.com',
      passwordHash,
      name: 'Alice Smith',
      role: 'patient',
    },
  });

  const patient2 = await prisma.user.create({
    data: {
      id: 'c293e7b3-877a-4b5a-b677-9ea743351042',
      email: 'patient2@wysa.com',
      passwordHash,
      name: 'Bob Wilson',
      role: 'patient',
    },
  });

  // Create therapist schedule matching the assignment example
  const scheduleData = [
    // Monday (1)
    { dayOfWeek: 1, startTime: '10:00', endTime: '10:30' },
    { dayOfWeek: 1, startTime: '13:30', endTime: '14:00' },
    { dayOfWeek: 1, startTime: '14:30', endTime: '15:00' },
    { dayOfWeek: 1, startTime: '15:30', endTime: '16:30' },
    // Tuesday (2)
    { dayOfWeek: 2, startTime: '16:30', endTime: '17:30' },
    { dayOfWeek: 2, startTime: '17:00', endTime: '17:30' },
    { dayOfWeek: 2, startTime: '17:30', endTime: '18:00' },
    // Thursday (4)
    { dayOfWeek: 4, startTime: '13:30', endTime: '14:00' },
    { dayOfWeek: 4, startTime: '14:00', endTime: '14:30' },
    { dayOfWeek: 4, startTime: '14:30', endTime: '15:00' },
    { dayOfWeek: 4, startTime: '15:30', endTime: '16:30' },
    // Friday (5)
    { dayOfWeek: 5, startTime: '10:00', endTime: '10:30' },
    { dayOfWeek: 5, startTime: '13:30', endTime: '14:00' },
    { dayOfWeek: 5, startTime: '14:30', endTime: '15:00' },
    { dayOfWeek: 5, startTime: '15:30', endTime: '16:30' },
  ];

  for (const slot of scheduleData) {
    await prisma.therapistSchedule.create({
      data: {
        therapistId: therapist.id,
        ...slot,
      },
    });
  }

  console.log('Seeded:');
  console.log(`  Therapist: ${therapist.email} (${therapist.name})`);
  console.log(`  Patient 1: ${patient1.email} (${patient1.name})`);
  console.log(`  Patient 2: ${patient2.email} (${patient2.name})`);
  console.log(`  Schedule slots: ${scheduleData.length}`);
  console.log('Done!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
