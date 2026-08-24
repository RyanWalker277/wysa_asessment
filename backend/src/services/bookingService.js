const { PrismaClient } = require('@prisma/client');
const { AppError } = require('../utils/errors');
const { generateRecurrenceDates, createRecurringAppointments } = require('./recurrenceService');

const prisma = new PrismaClient();

/**
 * Confirm a held appointment. Supports one-time and recurring bookings.
 * Uses idempotency key to prevent duplicate bookings across distributed servers.
 */
async function confirmBooking(appointmentId, patientId, { recurrence, idempotencyKey }) {
  // Check idempotency — return existing if already processed
  if (idempotencyKey) {
    const existing = await prisma.appointment.findUnique({
      where: { idempotencyKey },
      include: { recurrence: true },
    });
    if (existing) {
      return { appointment: existing, alreadyProcessed: true };
    }
  }

  const result = await prisma.$transaction(async (tx) => {
    const appointment = await tx.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new AppError('Appointment not found', 404);
    }

    if (appointment.patientId !== patientId) {
      throw new AppError('Not authorized', 403);
    }

    if (appointment.status !== 'held') {
      throw new AppError('Appointment is not in held status', 400);
    }

    // Check if hold has expired
    if (appointment.holdExpiresAt && new Date(appointment.holdExpiresAt) < new Date()) {
      // Clean up the expired hold
      await tx.appointment.delete({ where: { id: appointmentId } });
      throw new AppError('Hold has expired. Please try again.', 410);
    }

    // Confirm the appointment
    const confirmed = await tx.appointment.update({
      where: { id: appointmentId },
      data: {
        status: 'scheduled',
        holdExpiresAt: null,
        idempotencyKey: idempotencyKey || null,
      },
    });

    let recurrenceResult = null;

    // If recurring, create the recurrence and future appointments
    if (recurrence && recurrence.frequency) {
      const startDate = new Date(appointment.startTime);
      const startTimeStr = `${String(startDate.getUTCHours()).padStart(2, '0')}:${String(startDate.getUTCMinutes()).padStart(2, '0')}`;
      const endDate = new Date(appointment.endTime);
      const endTimeStr = `${String(endDate.getUTCHours()).padStart(2, '0')}:${String(endDate.getUTCMinutes()).padStart(2, '0')}`;

      const rec = await tx.recurrence.create({
        data: {
          patientId,
          therapistId: appointment.therapistId,
          frequency: recurrence.frequency,
          dayOfWeek: startDate.getUTCDay(),
          startTime: startTimeStr,
          endTime: endTimeStr,
          startDate: startDate,
        },
      });

      // Link the original appointment to the recurrence
      await tx.appointment.update({
        where: { id: appointmentId },
        data: { recurrenceId: rec.id },
      });

      // Generate future instances
      const futureDates = generateRecurrenceDates(
        recurrence.frequency,
        startDate,
        startTimeStr,
        endTimeStr,
        12 // Generate 12 future instances
      );

      recurrenceResult = await createRecurringAppointments(
        tx,
        rec.id,
        patientId,
        appointment.therapistId,
        futureDates,
        idempotencyKey || appointmentId
      );

      recurrenceResult.recurrence = rec;
    }

    return { appointment: confirmed, recurrenceResult };
  });

  return result;
}

module.exports = { confirmBooking };
