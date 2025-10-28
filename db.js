const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// Ensure /data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Connect to SQLite database
const dbPath = path.join(dataDir, 'ticketboss.db');
const db = new Database(dbPath);

// Initialize tables
db.prepare(`
  CREATE TABLE IF NOT EXISTS events (
    eventId TEXT PRIMARY KEY,
    name TEXT,
    totalSeats INTEGER,
    availableSeats INTEGER,
    version INTEGER
  )
`).run();

db.prepare(`
  CREATE TABLE IF NOT EXISTS reservations (
    reservationId TEXT PRIMARY KEY,
    partnerId TEXT,
    seats INTEGER,
    status TEXT
  )
`).run();

// Check if event already exists, else seed it
const existingEvent = db.prepare('SELECT * FROM events WHERE eventId = ?').get('node-meetup-2025');

if (!existingEvent) {
  db.prepare(`
    INSERT INTO events (eventId, name, totalSeats, availableSeats, version)
    VALUES (@eventId, @name, @totalSeats, @availableSeats, @version)
  `).run({
    eventId: 'node-meetup-2025',
    name: 'Node.js Meet-up',
    totalSeats: 500,
    availableSeats: 500,
    version: 0
  });

  console.log('✅ Event seeded: Node.js Meet-up with 500 seats.');
} else {
  console.log('ℹ️ Event already exists, skipping seeding.');
}

module.exports = db;
