# TicketBoss — Tiny Event Ticketing API

## Overview
TicketBoss is a minimal Node.js + SQLite API that allows partners to reserve and cancel seats for a single event (`node-meetup-2025`) with optimistic concurrency control (OCC). The API prevents overselling and provides instant accept/deny responses.

## Features
- Seed the event on first run (500 seats).
- POST /reservations to reserve up to 10 seats per request.
- DELETE /reservations/:reservationId to cancel a reservation and return seats.
- GET /reservations returns event summary and reservation count.
- Optimistic concurrency implemented using a version integer on the event row.
- Simple, single-file SQLite database (`data/ticketboss.db`) using better-sqlite3.

## Design & Technical Decisions
- **Storage**: SQLite via better-sqlite3. It's file-based, lightweight, and supports transactions—good for a demo of OCC without requiring an external DB.
- **Optimistic Concurrency**: Each update checks the version value and performs the UPDATE ... WHERE version = ?. If the row wasn't updated (0 rows affected), another concurrent change happened → respond with 409 Conflict.
- **Reservations**: Stored in reservations table with status column (confirmed or cancelled).
- **Why this approach**: It's simple, reliable, and easily reproducible. It demonstrates OCC clearly and keeps the project self-contained.

## Setup Instructions

1. Clone or download project files.
2. Install dependencies:
```bash
npm install
```
3. Start the server:
```bash
npm start
```
The server listens on port 3000 by default.

On first start the DB will be created and seeded with the event:
```json
{
  "eventId": "node-meetup-2025",
  "name": "Node.js Meet-up",
  "totalSeats": 500,
  "availableSeats": 500,
  "version": 0
}
```

## API Documentation

### 1) Reserve Seats
**POST** `/reservations`
- Body:
```json
{
  "partnerId": "abc-corp",
  "seats": 3
}
```
- Validations:
  - `seats` must be integer, 1..10
  - `partnerId` required
- Responses:
  - `201 Created`:
  ```json
  {
    "reservationId": "uuid",
    "seats": 3,
    "status": "confirmed"
  }
  ```
  - `400 Bad Request` for validation errors
  - `409 Conflict` when not enough seats left (or OCC failure due to concurrent update)

### 2) Cancel Reservation
**DELETE** `/reservations/:reservationId`
- Responses:
  - `204 No Content` on success
  - `404 Not Found` if reservation unknown or already cancelled

### 3) Event Summary
**GET** `/reservations`
- Response `200 OK`:
```json
{
  "eventId": "node-meetup-2025",
  "name": "Node.js Meet-up",
  "totalSeats": 500,
  "availableSeats": 42,
  "reservationCount": 458,
  "version": 14
}
```

## Implementation Notes
- The event row stores `availableSeats` and `version`. When reserving:
  1. Start a transaction.
  2. Read current `availableSeats` and `version`.
  3. If enough seats, insert reservation record (status confirmed).
  4. Attempt to UPDATE event SET availableSeats = ?, version = version + 1 WHERE eventId = ? AND version = ?.
  5. If `changes === 1` commit; else rollback and return 409.
- Cancelation similarly uses the version check when updating availableSeats.

## Postman Collection
A `postman_collection.json` file is included for easy testing.

## Checking Database Contents
After starting the server and running a few operations, you can inspect the database manually using SQLite CLI:
```bash
sqlite3 data/ticketboss.db
```
Then run:
```sql
.tables
SELECT * FROM events;
SELECT * FROM reservations;
```

## Directory Structure
- index.js
- db.js
- controllers/reservations.js
- controllers/createReservation.js
- controllers/cancelReservation.js
- controllers/summaryreservations.js
- package.json
- README.md
- postman_collection.json
- data/ticketboss.db (created at runtime)
