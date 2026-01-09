# Restaurant Table Reservation System

A simple REST API for managing restaurant table reservations built with Node.js, Express, and SQLite.

## Features

### Core Functionality
- **Restaurant Management**: Create restaurants and manage their operating hours
- **Table Management**: Add tables with specific capacity to restaurants
- **Reservation System**: Create and manage reservations with automatic conflict detection
- **Availability Checking**: Get available time slots for a given party size and date
- **Double-Booking Prevention**: Automatic overlap detection prevents table double-booking
- **Business Logic Validation**:
  - Reservations only during operating hours
  - Party size cannot exceed table capacity
  - Automatic conflict resolution

## Tech Stack
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite3
- **Validation**: Zod
- **Testing**: Jest + Supertest
- **Development**: Nodemon

## Project Structure
```
.
├── controller/
│   ├── restaurantController.js
│   └── reservationController.js
├── db/
│   └── db.js
├── model/
│   └── schema.js
├── routes/
│   └── index.js
├── __tests__/
│   └── api.test.js
├── server.js
├── package.json
└── README.md
```

## Installation

### Option 1: Traditional Setup

1. Clone or navigate to the project directory
2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm run dev       # Development mode with hot reload
npm run server    # Production mode
```

### Option 2: Docker Setup (Recommended)

1. Make sure Docker is installed
2. Start with one command:

**Development (with hot reload):**
```bash
docker-compose up --build
```

**Production (persistent database):**
```bash
docker-compose -f docker-compose.prod.yml up -d
```

See [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md) for full Docker documentation.

### Running the Server

#### Without Docker
```bash
npm run dev          # Start with nodemon (auto-reload)
npm run server       # Start normally
npm test            # Run tests
```

#### With Docker
```bash
docker-compose up                    # Development
docker-compose exec app npm test     # Run tests
docker-compose down                  # Stop
```

The test suite covers:
- Restaurant CRUD operations
- Table management with validation
- Reservation creation with constraints
- Double-booking prevention
- Operating hours validation
- Party size validation
- Availability checking
- Error handling and edge cases

## Docker Support

This project is fully dockerized with development and production configurations.

**Development Setup:**
- Hot reload on code changes
- In-memory database for clean testing
- Full log visibility
- Container restarts on crash

**Production Setup:**
- Persistent SQLite database
- Health checks and auto-restart
- Optimized Alpine Linux image
- Runs as non-root user for security

See [DOCKER_QUICKSTART.md](DOCKER_QUICKSTART.md) or [DOCKER.md](DOCKER.md) for detailed Docker documentation.

## API Endpoints

### Restaurants

#### Create Restaurant
```http
POST /api/restaurants
Content-Type: application/json

{
  "name": "The Grill House",
  "opening_time": "10:00",
  "closing_time": "22:00"
}
```

#### Get All Restaurants
```http
GET /api/restaurants
```

#### Get Restaurant Details
```http
GET /api/restaurants/:id
```

#### Add Table to Restaurant
```http
POST /api/restaurants/:restaurant_id/tables
Content-Type: application/json

{
  "restaurant_id": 1,
  "table_number": 1,
  "capacity": 4
}
```

### Reservations

#### Create Reservation
```http
POST /api/reservations
Content-Type: application/json

{
  "restaurant_id": 1,
  "table_id": 1,
  "customer_name": "John Doe",
  "phone": "1234567890",
  "party_size": 2,
  "start_time": "2026-01-10T12:00:00Z",
  "duration_minutes": 90
}
```

#### Get Reservations by Date
```http
GET /api/restaurants/:restaurant_id/reservations/:date

# Example: GET /api/restaurants/1/reservations/2026-01-10
```

#### Get Available Time Slots
```http
GET /api/availability?restaurant_id=1&date=2026-01-10&party_size=2
```

#### Cancel Reservation
```http
PATCH /api/reservations/:id/cancel
```

#### Health Check
```http
GET /health
```

## Validation Rules

### Restaurant Creation
- Name: Non-empty string required
- Opening time: HH:MM format (24-hour)
- Closing time: HH:MM format (24-hour)

### Table Creation
- Restaurant ID: Must exist
- Table number: Unique per restaurant
- Capacity: Positive integer (minimum 1)

### Reservation Creation
- Restaurant ID & Table ID: Must exist and table must belong to restaurant
- Customer name: Non-empty string
- Phone: At least 10 digits
- Party size: Must not exceed table capacity
- Start time: ISO 8601 datetime format
- Duration: Minimum 15 minutes
- Availability: No overlapping reservations on same table
- Hours: Must be within restaurant operating hours

## Database Schema

### Restaurants Table
```sql
CREATE TABLE restaurants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  opening_time TEXT NOT NULL,
  closing_time TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
)
```

### Tables Table
```sql
CREATE TABLE tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL,
  table_number INTEGER NOT NULL,
  capacity INTEGER NOT NULL,
  UNIQUE (restaurant_id, table_number),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id)
)
```

### Reservations Table
```sql
CREATE TABLE reservations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL,
  table_id INTEGER NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  party_size INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (restaurant_id) REFERENCES restaurants(id),
  FOREIGN KEY (table_id) REFERENCES tables(id)
)
```

## Error Handling

All endpoints return appropriate HTTP status codes:
- **200**: Successful GET request
- **201**: Successful POST (creation)
- **400**: Bad request (validation errors)
- **404**: Resource not found
- **409**: Conflict (e.g., double-booking)
- **500**: Server error

Error responses include descriptive messages to help with debugging.

## Example Usage

```bash
# Create a restaurant
curl -X POST http://localhost:3000/api/restaurants \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Premium Dining",
    "opening_time": "11:00",
    "closing_time": "23:00"
  }'

# Add a table
curl -X POST http://localhost:3000/api/restaurants/1/tables \
  -H "Content-Type: application/json" \
  -d '{
    "restaurant_id": 1,
    "table_number": 1,
    "capacity": 4
  }'

# Create a reservation
curl -X POST http://localhost:3000/api/reservations \
  -H "Content-Type: application/json" \
  -d '{
    "restaurant_id": 1,
    "table_id": 1,
    "customer_name": "Alice Smith",
    "phone": "5551234567",
    "party_size": 2,
    "start_time": "2026-01-10T19:00:00Z",
    "duration_minutes": 120
  }'

# Check availability
curl "http://localhost:3000/api/availability?restaurant_id=1&date=2026-01-10&party_size=2"

# Get reservations for a date
curl http://localhost:3000/api/restaurants/1/reservations/2026-01-10
```

## Development

### Adding New Features
1. Create validation schema in the appropriate controller
2. Implement business logic with proper error handling
3. Add route in `routes/index.js`
4. Write tests in `__tests__/api.test.js`
5. Test with `npm test`

### Database Changes
- Update schema in `model/schema.js`
- Database initializes automatically on server start

## Notes

- The database uses SQLite with foreign key constraints enabled
- Reservations have indices on common query patterns (restaurant + date, table + date)
- Times are stored and returned in ISO 8601 format
- Phone validation requires at least 10 digits
- Default reservation status is 'confirmed'

## Future Enhancements

- User authentication and authorization
- Email notifications for reservations
- Cancellation policies and fees
- Rating and review system
- Integration with payment processing
- Advanced analytics and reporting
- Multi-language support
- Capacity planning and forecasting
