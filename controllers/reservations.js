const db = require('../db');
const Joi = require('joi');
const { v4: uuidv4 } = require('uuid');

//Maximum 10 Seats Per User 
const reserveSchema = Joi.object({
  partnerId: Joi.string().trim().required(),
  seats: Joi.number().integer().min(1).max(10).required()
});

function createReservation(req, res) {
  const { error, value } = reserveSchema.validate(req.body);
  if (error) return res.status(400).json({ error: error.message });

  const { partnerId, seats } = value;

  const eventSelect = db.prepare('SELECT eventId, name, totalSeats, availableSeats, version FROM event WHERE eventId = ?').get('node-meetup-2025');
  if (!eventSelect) return res.status(500).json({ error: 'Event not found' });

  // Quick fail if not enough seats (pre-check)
  if (seats > eventSelect.availableSeats) {
    return res.status(409).json({ error: 'Not enough seats left' });
  }

  const reservationId = uuidv4();
  const now = Date.now();

  // Optimistic concurrency using transaction and version check
  const insertReservation = db.prepare('INSERT INTO reservations (reservationId, partnerId, seats, status, createdAt) VALUES (?, ?, ?, ?, ?)');
  const updateEvent = db.prepare('UPDATE event SET availableSeats = ?, version = version + 1 WHERE eventId = ? AND version = ?');

  const tx = db.transaction(() => {
    insertReservation.run(reservationId, partnerId, seats, 'confirmed', now);
    const newAvailable = eventSelect.availableSeats - seats;
    const info = updateEvent.run(newAvailable, 'node-meetup-2025', eventSelect.version);
    if (info.changes !== 1) {
      // Simulate concurrency failure
      throw new Error('CONFLICT');
    }
  });

  try {
    tx();
    return res.status(201).json({
      reservationId,
      seats,
      status: 'confirmed'
    });
  } catch (err) {
    // If conflict, try to rollback reservation if inserted (transaction handles it)
    if (err.message === 'CONFLICT') {
      return res.status(409).json({ error: 'Not enough seats left' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


module.exports = {
  createReservation,
};
