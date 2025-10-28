const db = require('../db');
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
  getSummary,
};