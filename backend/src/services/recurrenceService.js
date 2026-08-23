const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../utils/errors');

const prisma = new PrismaClient();

/**
 * Generate future appointment dates for a recurrence pattern.
 * Returns an array of { startTime, endTime } Date pairs.
 */
function generateRecurrenceDates(frequency, startDate, startTimeStr, endTimeStr, count = 12) {
  const dates = [];
  const [startH, startM] = startTimeStr.split(':').map(Number);
  const [endH, endM] = endTimeStr.split(':').map(Number);

  for (let i = 1; i <= count; i++) {
    const date = new Date(startDate);

    switch (frequency) {
      case 'daily':
        date.setDate(date.getDate() + i);
        break;
      case 'weekly':
        date.setDate(date.getDate() + i * 7);
        break;
      case 'biweekly':
        date.setDate(date.getDate() + i * 14);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + i);
        break;
      default:
        throw new AppError(`Invalid frequency: ${frequency}`, 400);
    }

    const startTime = new Date(date);
    startTime.setHours(startH, startM, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endH, endM, 0, 0);

    dates.push({ startTime, endTime });
  }

  return dates;
}

/**
 * Check if a specific timeslot conflicts with existing appointments.
 */
async function hasConflict(tx, therapistId, startTime, excludeAppointmentId = null) {
  const where = {
    therapistId,
    startTime,
    status: { in: ['scheduled', 'completed', 'no_show'] },
  };

  if (excludeAppointmentId) {
    where.id = { not: excludeAppointmentId };
  }

  const conflict = await tx.appointment.findFirst({ where });
  return !!conflict;
}

/**
 * Create recurring appointment instances within a transaction.
 * Skips any dates that conflict with existing bookings.
 */
async function createRecurringAppointments(tx, recurrenceId, patientId, therapistId, dates, idempotencyPrefix) {
  const created = [];
  const skipped = [];

  for (let i = 0; i < dates.length; i++) {
    const { startTime, endTime } = dates[i];

    const conflict = await hasConflict(tx, therapistId, startTime);
    if (conflict) {
      skipped.push({ startTime: startTime.toISOString(), reason: 'conflict' });
      continue;
    }

    const appointment = await tx.appointment.create({
      data: {
        patientId,
        therapistId,
        startTime,
        endTime,
        status: 'scheduled',
        recurrenceId,
        idempotencyKey: `${idempotencyPrefix}_${i}`,
      },
    });

    created.push(appointment);
  }

  return { created, skipped };
}

/**
 * Cancel an entire recurring series (future appointments only).
 */
async function cancelRecurringSeries(recurrenceId, patientId) {
  const now = new Date();

  const recurrence = await prisma.recurrence.findUnique({
    where: { id: recurrenceId },
  });

  if (!recurrence) {
    throw new AppError('Recurrence not found', 404);
  }

  if (recurrence.patientId !== patientId) {
    throw new AppError('Not authorized', 403);
  }

  if (recurrence.status === 'cancelled') {
    throw new AppError('Recurrence already cancelled', 400);
  }

  await prisma.$transaction(async (tx) => {
    // Cancel future appointments in the series
    await tx.appointment.updateMany({
      where: {
        recurrenceId,
        startTime: { gt: now },
        status: { in: ['scheduled', 'held'] },
      },
      data: { status: 'cancelled' },
    });

    // Mark the recurrence as cancelled
    await tx.recurrence.update({
      where: { id: recurrenceId },
      data: { status: 'cancelled' },
    });
  });
}

module.exports = {
  generateRecurrenceDates,
  createRecurringAppointments,
  cancelRecurringSeries,
};
