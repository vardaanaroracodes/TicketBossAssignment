const express = require('express');
const bodyParser = require('express').json;
const db = require('./db');
const reservations = require('./controllers/reservations');

const app = express();
app.use(bodyParser());

//Book tickets at this route:
app.post('/reservations', reservations.createReservation);
//Cancel tickets at this route:
app.delete('/reservations/:reservationId', reservations.cancelReservation);
//Get summary at this route:
app.get('/reservations', reservations.getSummary);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`TicketBoss listening on port ${PORT}`);
});
