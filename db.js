const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const dbFile = path.join(dataDir, 'ticketboss.db');

const db = new Database(dbFile);

// Create tables if not exists
db.exec(`
CREATE TABLE IF NOT EXISTS event (
  eventId TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  totalSeats INTEGER NOT NULL,
  availableSeats INTEGER NOT NULL,
  version INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reservations (
  reservationId TEXT PRIMARY KEY,
  partnerId TEXT NOT NULL,
  seats INTEGER NOT NULL,
  status TEXT NOT NULL,
  createdAt INTEGER NOT NULL
);
`);

// Seed event on first run
const row = db.prepare('SELECT COUNT(*) as c FROM event WHERE eventId = ?').get('node-meetup-2025');
if (!row || row.c === 0) {
  const insert = db.prepare('INSERT INTO event (eventId, name, totalSeats, availableSeats, version) VALUES (?, ?, ?, ?, ?)');
  insert.run('node-meetup-2025', 'Node.js Meet-up', 500, 500, 0);
  console.log('Seeded event node-meetup-2025');
}

module.exports = db;
