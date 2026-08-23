const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/schedules — get therapist's own schedule
router.get(
  '/',
  authenticate,
  requireRole('therapist'),
  asyncHandler(async (req, res) => {
    const schedules = await prisma.therapistSchedule.findMany({
      where: { therapistId: req.user.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    res.json({ schedules });
  })
);

// PUT /api/schedules — replace therapist's schedule
// Existing bookings are stored as concrete timestamps, so they remain unaffected.
router.put(
  '/',
  authenticate,
  requireRole('therapist'),
  asyncHandler(async (req, res) => {
    const { slots } = req.body;

    if (!Array.isArray(slots)) {
      return res.status(400).json({ error: 'slots must be an array' });
    }

    // Validate each slot
    for (const slot of slots) {
      if (
        typeof slot.dayOfWeek !== 'number' ||
        slot.dayOfWeek < 0 ||
        slot.dayOfWeek > 6
      ) {
        return res.status(400).json({ error: 'Each slot must have a valid dayOfWeek (0-6)' });
      }
      if (!slot.startTime || !slot.endTime) {
        return res.status(400).json({ error: 'Each slot must have startTime and endTime' });
      }
      // Validate time format HH:mm
      const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (!timeRegex.test(slot.startTime) || !timeRegex.test(slot.endTime)) {
        return res.status(400).json({ error: 'Time must be in HH:mm format' });
      }
    }

    // Replace schedule in a transaction
    await prisma.$transaction(async (tx) => {
      // Delete existing schedule
      await tx.therapistSchedule.deleteMany({
        where: { therapistId: req.user.id },
      });

      // Create new schedule
      if (slots.length > 0) {
        await tx.therapistSchedule.createMany({
          data: slots.map((s) => ({
            therapistId: req.user.id,
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        });
      }
    });

    // Return the updated schedule
    const schedules = await prisma.therapistSchedule.findMany({
      where: { therapistId: req.user.id },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });

    res.json({ schedules, message: 'Schedule updated. Existing bookings are not affected.' });
  })
);

module.exports = router;
