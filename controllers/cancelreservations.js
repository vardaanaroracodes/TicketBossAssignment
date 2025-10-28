//Cancelling Reservation through the same OCC concept
const db = require('../db');
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
module.exports = {
  cancelReservation,
};