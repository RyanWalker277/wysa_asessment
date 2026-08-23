const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();

const HOLD_DURATION_MS = 60 * 1000; // 1 minute

/**
 * Hold a slot for a patient. Uses a transaction to prevent race conditions.
 * Expired holds on the same slot are cleaned up lazily.
 */
async function holdSlot(patientId, therapistId, startTime, endTime) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const now = new Date();

  if (start <= now) {
    throw new AppError('Cannot hold a slot in the past', 400);
  }

  // Check if this patient already has an active hold
  const existingHold = await prisma.appointment.findFirst({
    where: {
      patientId,
      status: 'held',
      holdExpiresAt: { gt: now },
    },
  });

  if (existingHold) {
    throw new AppError('You already have an active hold. Please confirm or wait for it to expire.', 409);
  }

  // Use a transaction to check for conflicts and create the hold atomically
  const appointment = await prisma.$transaction(async (tx) => {
    // Clean up any expired holds on this exact slot
    await tx.appointment.deleteMany({
      where: {
        therapistId,
        startTime: start,
        status: 'held',
        holdExpiresAt: { lte: now },
      },
    });

    // Check if the slot is already booked or actively held
    const conflict = await tx.appointment.findFirst({
      where: {
        therapistId,
        startTime: start,
        status: { in: ['scheduled', 'held', 'completed', 'no_show'] },
        OR: [
          { status: { in: ['scheduled', 'completed', 'no_show'] } },
          {
            status: 'held',
            holdExpiresAt: { gt: now },
          },
        ],
      },
    });

    if (conflict) {
      throw new AppError('This slot is no longer available', 409);
    }

    // Create the hold
    const holdExpiresAt = new Date(now.getTime() + HOLD_DURATION_MS);
    return tx.appointment.create({
      data: {
        patientId,
        therapistId,
        startTime: start,
        endTime: end,
        status: 'held',
        holdExpiresAt,
      },
    });
  });

  return appointment;
}

module.exports = { holdSlot, HOLD_DURATION_MS };
