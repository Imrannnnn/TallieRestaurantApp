const express = require('express');
const restaurantController = require('../controller/restaurantController');
const reservationController = require('../controller/reservationController');

const router = express.Router();


// RESTAURANT ENDPOINTS


// Create a new restaurant
router.post('/restaurants', restaurantController.createRestaurant);

// Get all restaurants in the system
router.get('/restaurants', restaurantController.getAllRestaurants);

// Get a specific restaurant with all its tables
router.get('/restaurants/:id', restaurantController.getRestaurant);

// Add a new table to a restaurant
router.post('/restaurants/:restaurant_id/tables', restaurantController.addTable);

// ============================================
// RESERVATION ENDPOINTS
// ============================================

// Create a new reservation
router.post('/reservations', reservationController.createReservation);

// Get all reservations for a specific date
router.get('/restaurants/:restaurant_id/reservations/:date', reservationController.getReservationsByDate);

// Find available time slots for booking
router.get('/availability', reservationController.getAvailableSlots);

// Cancel an existing reservation
router.patch('/reservations/:id/cancel', reservationController.cancelReservation);

module.exports = router;
