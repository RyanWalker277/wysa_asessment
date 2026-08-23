const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Derive available slots for a therapist on a specific date.
 * Filters out slots that are already booked, actively held, or
 * conflict with a recurring booking.
 */
async function getAvailableSlots(therapistId, dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay(); // 0=Sunday

  // Get the therapist's schedule for this day of the week
  const scheduleSlots = await prisma.therapistSchedule.findMany({
    where: { therapistId, dayOfWeek },
    orderBy: { startTime: 'asc' },
  });

  if (scheduleSlots.length === 0) return [];

  // Build concrete datetime for each slot on the requested date
  const now = new Date();
  const slots = scheduleSlots.map((s) => {
    const [startH, startM] = s.startTime.split(':').map(Number);
    const [endH, endM] = s.endTime.split(':').map(Number);

    const startTime = new Date(date);
    startTime.setHours(startH, startM, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(endH, endM, 0, 0);

    return {
      scheduleId: s.id,
      startTime,
      endTime,
      startTimeStr: s.startTime,
      endTimeStr: s.endTime,
    };
  });

  // Get existing appointments for this therapist on this date that block availability
  const dayStart = new Date(date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date);
  dayEnd.setHours(23, 59, 59, 999);

  const existingAppointments = await prisma.appointment.findMany({
    where: {
      therapistId,
      startTime: { gte: dayStart, lte: dayEnd },
      OR: [
        // Booked (scheduled)
        { status: 'scheduled' },
        // Completed
        { status: 'completed' },
        // No-show (still occupies the slot)
        { status: 'no_show' },
        // Actively held (not expired)
        {
          status: 'held',
          holdExpiresAt: { gt: now },
        },
      ],
    },
  });

  // Build a set of blocked time ranges
  const blockedSlots = new Set(
    existingAppointments.map((a) => a.startTime.toISOString())
  );

  // Filter to available only, and exclude past slots
  const available = slots.filter((s) => {
    if (s.startTime <= now) return false; // Past slots not available
    return !blockedSlots.has(s.startTime.toISOString());
  });

  return available.map((s) => ({
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    startTimeStr: s.startTimeStr,
    endTimeStr: s.endTimeStr,
  }));
}

module.exports = { getAvailableSlots };
