const { dbRun, dbGet, dbAll } = require('../db/db');
const { z } = require('zod');

// Validation rules for creating a reservation
// Ensures all required fields are present and in the correct format
const createReservationSchema = z.object({
  restaurant_id: z.number().int().positive('Need a valid restaurant ID'),
  table_id: z.number().int().positive('Need a valid table ID'),
  customer_name: z.string().min(1, 'Please provide the customer name'),
  phone: z.string().regex(/^\d{10,}$/, 'Phone number needs to be at least 10 digits'),
  party_size: z.number().int().positive('Party size must be at least 1 person'),
  start_time: z.string().datetime('Please use ISO 8601 format for the time (e.g., 2026-01-10T19:00:00Z)'),
  duration_minutes: z.number().int().positive().min(15, 'Reservations need to be at least 15 minutes long')
});

// Check if a reservation time falls within restaurant's operating hours
// Returns true if the entire reservation fits within opening and closing times
const isWithinOperatingHours = (restaurant, startTime, endTime) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  // Extract hours and minutes from the dates
  const startHour = start.getHours().toString().padStart(2, '0');
  const startMinute = start.getMinutes().toString().padStart(2, '0');
  const startTimeStr = `${startHour}:${startMinute}`;
  
  const endHour = end.getHours().toString().padStart(2, '0');
  const endMinute = end.getMinutes().toString().padStart(2, '0');
  const endTimeStr = `${endHour}:${endMinute}`;
  
  // Compare times as strings (HH:MM can be compared lexicographically)
  const startsAfterOpening = startTimeStr >= restaurant.opening_time;
  const endsBeforeClosing = endTimeStr <= restaurant.closing_time;
  
  return startsAfterOpening && endsBeforeClosing;
};

// Check if a table is already booked for the requested time slot
// Prevents double-booking by finding any overlapping active reservations
const checkForOverlaps = async (table_id, start_time, duration_minutes) => {
  const startDate = new Date(start_time);
  const endDate = new Date(startDate.getTime() + duration_minutes * 60000);
  
  // Look for any active reservations that overlap with our requested time
  // We check both 'confirmed' and 'pending' reservations to be safe
  const overlapping = await dbAll(
    `SELECT * FROM reservations 
     WHERE table_id = ? 
     AND status IN ('confirmed', 'pending')
     AND (
       (datetime(start_time) < datetime(?) AND datetime(datetime(start_time), '+' || duration_minutes || ' minutes') > datetime(?))
       OR (datetime(start_time) = datetime(?))
     )`,
    [table_id, endDate.toISOString(), startDate.toISOString(), startDate.toISOString()]
  );
  
  // Returns true if any overlapping reservations exist
  return overlapping.length > 0;
};

// Create a new reservation - with comprehensive validation
// This is the main endpoint customers use to book tables
const createReservation = async (req, res) => {
  try {
    const validated = createReservationSchema.parse(req.body);
    
    // Step 1: Verify the restaurant exists
    const restaurant = await dbGet(
      'SELECT * FROM restaurants WHERE id = ?',
      [validated.restaurant_id]
    );
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    // Step 2: Verify the table exists AND belongs to this restaurant
    // (Someone could try to book a table from another restaurant)
    const table = await dbGet(
      'SELECT * FROM tables WHERE id = ? AND restaurant_id = ?',
      [validated.table_id, validated.restaurant_id]
    );
    
    if (!table) {
      return res.status(404).json({ error: 'Table not found in this restaurant' });
    }
    
    // Step 3: Ensure the party size fits the table
    if (validated.party_size > table.capacity) {
      return res.status(400).json({ 
        error: `Sorry, this table seats ${table.capacity} people but you need space for ${validated.party_size}` 
      });
    }
    
    // Step 4: Check the reservation time is during operating hours
    // Calculate when the reservation would end
    const endTime = new Date(
      new Date(validated.start_time).getTime() + validated.duration_minutes * 60000
    ).toISOString();
    
    if (!isWithinOperatingHours(restaurant, validated.start_time, endTime)) {
      return res.status(400).json({ 
        error: `We're only open ${restaurant.opening_time} to ${restaurant.closing_time}` 
      });
    }
    
    // Step 5: Make sure no one else has booked this table at the same time
    const hasOverlap = await checkForOverlaps(
      validated.table_id, 
      validated.start_time, 
      validated.duration_minutes
    );
    
    if (hasOverlap) {
      return res.status(409).json({ 
        error: 'This table is already booked for that time. Try another time or table.' 
      });
    }
    
    // Step 6: All checks passed - create the reservation
    const result = await dbRun(
      `INSERT INTO reservations 
       (restaurant_id, table_id, customer_name, phone, party_size, start_time, duration_minutes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
      [
        validated.restaurant_id,
        validated.table_id,
        validated.customer_name,
        validated.phone,
        validated.party_size,
        validated.start_time,
        validated.duration_minutes
      ]
    );
    
    // Return the created reservation
    res.status(201).json({
      id: result.id,
      ...validated,
      status: 'confirmed',
      created_at: new Date().toISOString()
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.flatten().fieldErrors });
    }
    res.status(500).json({ error: error.message });
  }
};

// Get all reservations for a restaurant on a specific date
// Useful for seeing the day's schedule and table availability
const getReservationsByDate = async (req, res) => {
  try {
    const { restaurant_id, date } = req.params;
    
    // Make sure the date format is correct (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ 
        error: 'Date must be in YYYY-MM-DD format (e.g., 2026-01-10)' 
      });
    }
    
    // Verify restaurant exists
    const restaurant = await dbGet(
      'SELECT * FROM restaurants WHERE id = ?',
      [restaurant_id]
    );
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    // Fetch all reservations for the day, joined with table info
    const reservations = await dbAll(
      `SELECT r.*, t.table_number, t.capacity
       FROM reservations r
       JOIN tables t ON r.table_id = t.id
       WHERE r.restaurant_id = ? AND DATE(r.start_time) = ?
       ORDER BY r.start_time`,
      [restaurant_id, date]
    );
    
    res.json(reservations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Find available time slots for booking a table
// Returns 15-minute intervals where the restaurant has open tables for the party size
const getAvailableSlots = async (req, res) => {
  try {
    const { restaurant_id, date, party_size } = req.query;
    
    // Validate required parameters
    if (!restaurant_id || !date || !party_size) {
      return res.status(400).json({ 
        error: 'Missing required params. Use: ?restaurant_id=1&date=2026-01-10&party_size=2' 
      });
    }
    
    // Check that the restaurant exists
    const restaurant = await dbGet(
      'SELECT * FROM restaurants WHERE id = ?',
      [restaurant_id]
    );
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    // Find tables big enough for the party
    const availableTables = await dbAll(
      'SELECT * FROM tables WHERE restaurant_id = ? AND capacity >= ? ORDER BY capacity',
      [restaurant_id, party_size]
    );
    
    // No suitable tables found
    if (availableTables.length === 0) {
      return res.json({ available_slots: [] });
    }
    
    // Generate all 15-minute time slots between opening and closing
    const slots = [];
    const [openHour, openMin] = restaurant.opening_time.split(':').map(Number);
    const [closeHour, closeMin] = restaurant.closing_time.split(':').map(Number);
    
    // Loop through all hours and minutes in 15-min increments
    for (let h = openHour; h < closeHour; h++) {
      for (let m = 0; m < 60; m += 15) {
        const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
        const slotDate = new Date(`${date}T${timeStr}:00`);
        
        // Try to find a table that's free at this time
        let availableTable = null;
        for (const table of availableTables) {
          const hasOverlap = await checkForOverlaps(table.id, slotDate.toISOString(), 90);
          if (!hasOverlap) {
            availableTable = table;
            break; // Found an available table, move to next time slot
          }
        }
        
        // Add to results if we found an open table at this time
        if (availableTable) {
          slots.push({
            time: slotDate.toISOString(),
            table_id: availableTable.id,
            table_number: availableTable.table_number
          });
        }
      }
    }
    
    res.json({ available_slots: slots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cancel an existing reservation
// Changes status to 'cancelled' instead of deleting the record
// (This preserves history and prevents accidental data loss)
const cancelReservation = async (req, res) => {
  try {
    const { id } = req.params;
    
    // First check if the reservation exists
    const reservation = await dbGet(
      'SELECT * FROM reservations WHERE id = ?',
      [id]
    );
    
    if (!reservation) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    
    // Mark it as cancelled (soft delete)
    await dbRun(
      'UPDATE reservations SET status = ? WHERE id = ?',
      ['cancelled', id]
    );
    
    res.json({ message: 'Reservation cancelled', id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createReservation,
  getReservationsByDate,
  getAvailableSlots,
  cancelReservation
};
