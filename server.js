const express = require('express');
const { initializeDatabase } = require('./db/db');
const routes = require('./routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Parse incoming JSON requests
app.use(express.json());

// Mount all API routes under /api prefix
app.use('/api', routes);

// Simple health check - useful for monitoring and load balancers
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Catch-all error handler - logs errors and sends generic response
// (In production, you'd want more detailed error handling)
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).json({ error: 'Something went wrong on our end' });
});

// Initialize the database and fire up the server
const startServer = async () => {
  try {
    await initializeDatabase();
    app.listen(PORT, () => {
      console.log(`🚀 Restaurant API running on http://localhost:${PORT}`);
      console.log(`Try GET http://localhost:${PORT}/api/restaurants`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Only start the server if this file is run directly (not imported)
if (require.main === module) {
  startServer();
}

module.exports = app;
