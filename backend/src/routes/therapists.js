const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');
const { getAvailableSlots } = require('../services/slotService');

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/therapists — list all therapists
router.get(
  '/',
  authenticate,
  asyncHandler(async (req, res) => {
    const therapists = await prisma.user.findMany({
      where: { role: 'therapist' },
      select: { id: true, name: true, email: true },
    });
    res.json({ therapists });
  })
);

// GET /api/therapists/:id/slots?date=YYYY-MM-DD — get available slots
router.get(
  '/:id/slots',
  authenticate,
  requireRole('patient'),
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: 'date query parameter is required (YYYY-MM-DD)' });
    }

    // Validate therapist exists
    const therapist = await prisma.user.findFirst({
      where: { id, role: 'therapist' },
    });
    if (!therapist) {
      return res.status(404).json({ error: 'Therapist not found' });
    }

    const slots = await getAvailableSlots(id, date);
    res.json({ slots, therapist: { id: therapist.id, name: therapist.name } });
  })
);

module.exports = router;
