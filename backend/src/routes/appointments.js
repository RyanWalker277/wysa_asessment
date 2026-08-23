const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../utils/errors');
const { holdSlot } = require('../services/holdService');
const { confirmBooking } = require('../services/bookingService');
const { cancelRecurringSeries } = require('../services/recurrenceService');

const router = express.Router();
const prisma = new PrismaClient();

// POST /api/appointments/hold — hold a slot
router.post(
  '/hold',
  authenticate,
  requireRole('patient'),
  asyncHandler(async (req, res) => {
    const { therapistId, startTime, endTime } = req.body;

    if (!therapistId || !startTime || !endTime) {
      return res.status(400).json({ error: 'therapistId, startTime, and endTime are required' });
    }

    const appointment = await holdSlot(req.user.id, therapistId, startTime, endTime);
    res.status(201).json({ appointment });
  })
);

// POST /api/appointments/confirm — confirm a held appointment
router.post(
  '/confirm',
  authenticate,
  requireRole('patient'),
  asyncHandler(async (req, res) => {
    const { appointmentId, recurrence, idempotencyKey } = req.body;

    if (!appointmentId) {
      return res.status(400).json({ error: 'appointmentId is required' });
    }

    const result = await confirmBooking(appointmentId, req.user.id, {
      recurrence,
      idempotencyKey,
    });

    if (result.alreadyProcessed) {
      return res.json({ appointment: result.appointment, message: 'Already processed (idempotent)' });
    }

    res.status(201).json(result);
  })
);

// GET /api/appointments — list appointments for current user
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const where = {};

    if (req.user.role === 'patient') {
      where.patientId = req.user.id;
    } else if (req.user.role === 'therapist') {
      where.therapistId = req.user.id;
    }

    // Exclude expired holds from results
    const now = new Date();

    const appointments = await prisma.appointment.findMany({
      where: {
        ...where,
        NOT: {
          status: 'held',
          holdExpiresAt: { lte: now },
        },
      },
      include: {
        patient: { select: { id: true, name: true, email: true } },
        therapist: { select: { id: true, name: true, email: true } },
        recurrence: true,
      },
      orderBy: { startTime: 'asc' },
    });

    res.json({ appointments });
  })
);

// PATCH /api/appointments/:id/cancel — cancel a single appointment
router.patch(
  '/:id/cancel',
  authenticate,
  asyncHandler(async (req, res) => {
    const { id } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Patients can cancel their own appointments
    if (req.user.role === 'patient' && appointment.patientId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Therapists can cancel appointments assigned to them
    if (req.user.role === 'therapist' && appointment.therapistId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (appointment.status === 'cancelled') {
      return res.status(400).json({ error: 'Appointment already cancelled' });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status: 'cancelled' },
    });

    res.json({ appointment: updated });
  })
);

// PATCH /api/appointments/:id/status — therapist updates appointment status
router.patch(
  '/:id/status',
  authenticate,
  requireRole('therapist'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['scheduled', 'completed', 'no_show', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.therapistId !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Therapist can only update status during or after the appointment window
    const now = new Date();
    if (status !== 'cancelled' && now < new Date(appointment.startTime)) {
      return res.status(400).json({
        error: 'Can only update status during or after the appointment window',
      });
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: { status },
    });

    res.json({ appointment: updated });
  })
);

// PATCH /api/recurrences/:id/cancel — cancel entire recurring series
router.patch(
  '/recurrences/:id/cancel',
  authenticate,
  requireRole('patient'),
  asyncHandler(async (req, res) => {
    await cancelRecurringSeries(req.params.id, req.user.id);
    res.json({ message: 'Recurring series cancelled' });
  })
);

module.exports = router;
