const request = require('supertest');
const app = require('../server');
const { initializeDatabase } = require('../db/db');

describe('Restaurant Reservation API', () => {
  let restaurantId;
  let tableId;
  
  beforeAll(async () => {
    // Clear and reinitialize the database before running tests
    await initializeDatabase();
  });

  describe('Restaurant Management', () => {
    test('should create a new restaurant with valid data', async () => {
      const res = await request(app)
        .post('/api/restaurants')
        .send({
          name: 'The Grill House',
          opening_time: '10:00',
          closing_time: '22:00'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('The Grill House');
      expect(res.body.opening_time).toBe('10:00');
      expect(res.body.closing_time).toBe('22:00');
      
      // Save for later tests
      restaurantId = res.body.id;
    });

    test('should reject restaurant with invalid time format', async () => {
      const res = await request(app)
        .post('/api/restaurants')
        .send({
          name: 'Invalid Restaurant',
          opening_time: '10:00:00',  // Wrong format
          closing_time: '22:00'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('errors');
    });

    test('should return all restaurants', async () => {
      const res = await request(app)
        .get('/api/restaurants');

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    test('should return specific restaurant with tables', async () => {
      const res = await request(app)
        .get(`/api/restaurants/${restaurantId}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.id).toBe(restaurantId);
      expect(res.body.name).toBe('The Grill House');
      expect(res.body).toHaveProperty('tables');
      expect(Array.isArray(res.body.tables)).toBe(true);
    });

    test('should add a table to restaurant', async () => {
      const res = await request(app)
        .post(`/api/restaurants/${restaurantId}/tables`)
        .send({
          restaurant_id: restaurantId,
          table_number: 1,
          capacity: 4
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.table_number).toBe(1);
      expect(res.body.capacity).toBe(4);
      
      // Save for later reservation tests
      tableId = res.body.id;
    });

    test('should add multiple tables to same restaurant', async () => {
      for (let i = 2; i <= 5; i++) {
        const res = await request(app)
          .post(`/api/restaurants/${restaurantId}/tables`)
          .send({
            restaurant_id: restaurantId,
            table_number: i,
            capacity: 4
          });
        
        expect(res.statusCode).toBe(201);
        expect(res.body.table_number).toBe(i);
      }
    });

    test('should reject duplicate table number', async () => {
      const res = await request(app)
        .post(`/api/restaurants/${restaurantId}/tables`)
        .send({
          restaurant_id: restaurantId,
          table_number: 1,  // Already exists
          capacity: 4
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toContain('already exists');
    });
  });

  describe('Reservation System', () => {
    test('should create a valid reservation', async () => {
      // Create a future date at a time during opening hours
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      futureDate.setHours(12, 0, 0, 0);

      const res = await request(app)
        .post('/api/reservations')
        .send({
          restaurant_id: restaurantId,
          table_id: tableId,
          customer_name: 'John Doe',
          phone: '1234567890',
          party_size: 2,
          start_time: futureDate.toISOString(),
          duration_minutes: 90
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.customer_name).toBe('John Doe');
      expect(res.body.status).toBe('confirmed');
      expect(res.body).toHaveProperty('id');
    });

    test('should reject reservation with party larger than table capacity', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      futureDate.setHours(14, 0, 0, 0);

      const res = await request(app)
        .post('/api/reservations')
        .send({
          restaurant_id: restaurantId,
          table_id: tableId,
          customer_name: 'Jane Doe',
          phone: '1234567890',
          party_size: 10,  // Table only seats 4
          start_time: futureDate.toISOString(),
          duration_minutes: 90
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('seats');
    });

    test('should reject reservation outside operating hours', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      futureDate.setHours(9, 0, 0, 0);  // Restaurant opens at 10:00

      const res = await request(app)
        .post('/api/reservations')
        .send({
          restaurant_id: restaurantId,
          table_id: tableId,
          customer_name: 'Early Bird',
          phone: '1234567890',
          party_size: 2,
          start_time: futureDate.toISOString(),
          duration_minutes: 90
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('open');
    });

    test('should reject overlapping reservations on same table', async () => {
      // The first test created a reservation at 12:00-13:30
      // Try to book at 12:15 - should conflict
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      futureDate.setHours(12, 15, 0, 0);

      const res = await request(app)
        .post('/api/reservations')
        .send({
          restaurant_id: restaurantId,
          table_id: tableId,
          customer_name: 'Conflicting Guest',
          phone: '0987654321',
          party_size: 2,
          start_time: futureDate.toISOString(),
          duration_minutes: 90
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.error).toContain('already booked');
    });

    test('should return reservations for a specific date', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);
      const dateStr = futureDate.toISOString().split('T')[0];

      const res = await request(app)
        .get(`/api/restaurants/${restaurantId}/reservations/${dateStr}`);

      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      
      // Verify the reservation includes table info
      expect(res.body[0]).toHaveProperty('table_number');
      expect(res.body[0]).toHaveProperty('capacity');
    });

    test('should find available time slots', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 2);  // Use a day with no reservations
      const dateStr = futureDate.toISOString().split('T')[0];

      const res = await request(app)
        .get('/api/availability')
        .query({
          restaurant_id: restaurantId,
          date: dateStr,
          party_size: 2
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('available_slots');
      expect(Array.isArray(res.body.available_slots)).toBe(true);
      expect(res.body.available_slots.length).toBeGreaterThan(0);
    });

    test('should reject availability query with missing parameters', async () => {
      const res = await request(app)
        .get('/api/availability')
        .query({
          restaurant_id: restaurantId
          // Missing date and party_size
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toContain('Missing');
    });
  });

  describe('System Health', () => {
    test('health check should return ok status', async () => {
      const res = await request(app)
        .get('/health');

      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});
