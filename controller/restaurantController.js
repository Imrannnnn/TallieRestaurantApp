const { dbRun, dbGet, dbAll } = require('../db/db');
const { z } = require('zod');

// Validation rules for creating restaurants
// Using Zod to ensure data is valid before it hits the database
const createRestaurantSchema = z.object({
  name: z.string().min(1, 'Please provide a restaurant name'),
  opening_time: z.string().regex(/^\d{2}:\d{2}$/, 'Opening time should be HH:MM (like 10:00)'),
  closing_time: z.string().regex(/^\d{2}:\d{2}$/, 'Closing time should be HH:MM (like 22:00)')
});

// Validation rules for adding a table to a restaurant
const addTableSchema = z.object({
  restaurant_id: z.number().int().positive('Restaurant ID must be a positive number'),
  table_number: z.number().int().positive('Table number must be a positive number'),
  capacity: z.number().int().positive('Capacity must be at least 1 person')
});

// Create a new restaurant with opening/closing times
const createRestaurant = async (req, res) => {
  try {
    // First validate the incoming data matches our schema
    const validated = createRestaurantSchema.parse(req.body);
    
    // Insert into database and get back the new ID
    const result = await dbRun(
      'INSERT INTO restaurants (name, opening_time, closing_time) VALUES (?, ?, ?)',
      [validated.name, validated.opening_time, validated.closing_time]
    );
    
    // Return 201 Created with the new restaurant object
    res.status(201).json({
      id: result.id,
      ...validated,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    // Validation error - return 400 with field-level errors
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.flatten().fieldErrors });
    }
    // Something unexpected happened
    res.status(500).json({ error: error.message });
  }
};


// get all restaurant and all it tables

// Get a specific restaurant and all its tables
const getRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Look up the restaurant
    const restaurant = await dbGet(
      'SELECT * FROM restaurants WHERE id = ?',
      [id]
    );

    //get all restaurant and  all it tables


    
    // Return 404 if restaurant doesn't exist
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    // Get all tables for this restaurant, sorted by table number
    const tables = await dbAll(
      'SELECT * FROM tables WHERE restaurant_id = ? ORDER BY table_number',
      [id]
    );
    
    // Return restaurant with its tables
    res.json({
      ...restaurant,
      tables
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Add a new table to a restaurant
const addTable = async (req, res) => {
  try {
    // Allow `restaurant_id` to be provided either in the URL param
    // (`/restaurants/:restaurant_id/tables`) or in the JSON body.
    const paramRestaurantId = req.params && req.params.restaurant_id
      ? parseInt(req.params.restaurant_id, 10)
      : undefined;

    // If param was provided but not a valid number, return 400
    if (paramRestaurantId !== undefined && Number.isNaN(paramRestaurantId)) {
      return res.status(400).json({ error: 'Invalid restaurant_id in URL' });
    }

    // Merge body with param (param takes precedence)
    const dataToValidate = {
      ...(req.body || {}),
      ...(paramRestaurantId ? { restaurant_id: paramRestaurantId } : {})
    };

    // Validate input data
    const validated = addTableSchema.parse(dataToValidate);

    // Make sure the restaurant exists before adding a table to it
    const restaurant = await dbGet(
      'SELECT * FROM restaurants WHERE id = ?',
      [validated.restaurant_id]
    );
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    // Check if this table number is already taken at this restaurant
    // (Each restaurant can have a table 1, but only one table 1 per restaurant)
    const existing = await dbGet(
      'SELECT * FROM tables WHERE restaurant_id = ? AND table_number = ?',
      [validated.restaurant_id, validated.table_number]
    );
    
    if (existing) {
      return res.status(409).json({ 
        error: `Table ${validated.table_number} already exists for this restaurant` 
      });
    }
    
    // Insert the new table
    const result = await dbRun(
      'INSERT INTO tables (restaurant_id, table_number, capacity) VALUES (?, ?, ?)',
      [validated.restaurant_id, validated.table_number, validated.capacity]
    );
    
    res.status(201).json({
      id: result.id,
      ...validated
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.flatten().fieldErrors });
    }
    res.status(500).json({ error: error.message });
  }
};

// Fetch all restaurants in the system
const getAllRestaurants = async (req, res) => {
  try {
    const restaurants = await dbAll(
      'SELECT * FROM restaurants ORDER BY name'
    );
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  createRestaurant,
  getRestaurant,
  addTable,
  getAllRestaurants
};
