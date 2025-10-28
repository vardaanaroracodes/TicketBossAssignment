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

//Cancelling Reservation through the same OCC concept
function cancelReservation(req, res) {
  const reservationId = req.params.reservationId;
  if (!reservationId) return res.status(400).json({ error: 'reservationId required' });

  const reservation = db.prepare('SELECT reservationId, seats, status FROM reservations WHERE reservationId = ?').get(reservationId);
  if (!reservation || reservation.status !== 'confirmed') {
    return res.status(404).json({ error: 'Reservation not found or already cancelled' });
  }

  const eventSelect = db.prepare('SELECT availableSeats, version FROM event WHERE eventId = ?').get('node-meetup-2025');
  if (!eventSelect) return res.status(500).json({ error: 'Event not found' });

  const updateReservation = db.prepare('UPDATE reservations SET status = ? WHERE reservationId = ? AND status = ?');
  const updateEvent = db.prepare('UPDATE event SET availableSeats = ?, version = version + 1 WHERE eventId = ? AND version = ?');

  const tx = db.transaction(() => {
    const rinfo = updateReservation.run('cancelled', reservationId, 'confirmed');
    if (rinfo.changes !== 1) throw new Error('NOT_FOUND');
    const newAvailable = eventSelect.availableSeats + reservation.seats;
    const einfo = updateEvent.run(newAvailable, 'node-meetup-2025', eventSelect.version);
    if (einfo.changes !== 1) throw new Error('CONFLICT');
  });

  try {
    tx();
    return res.status(204).send();
  } catch (err) {
    if (err.message === 'NOT_FOUND') return res.status(404).json({ error: 'Reservation not found or already cancelled' });
    if (err.message === 'CONFLICT') return res.status(409).json({ error: 'Conflict while cancelling. Try again' });
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function getSummary(req, res) {
  const event = db.prepare('SELECT eventId, name, totalSeats, availableSeats, version FROM event WHERE eventId = ?').get('node-meetup-2025');
  if (!event) return res.status(500).json({ error: 'Event not found' });

  const reservationCountRow = db.prepare('SELECT COUNT(*) as c FROM reservations WHERE status = ?').get('confirmed');

  return res.status(200).json({
    eventId: event.eventId,
    name: event.name,
    totalSeats: event.totalSeats,
    availableSeats: event.availableSeats,
    reservationCount: reservationCountRow.c,
    version: event.version
  });
}

module.exports = {
  createReservation,
  cancelReservation,
  getSummary
};
