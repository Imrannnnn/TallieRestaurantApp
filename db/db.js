const sqlite3 = require("sqlite3").verbose();
const schema = require("../model/schema");

// Create or connect to SQLite database
// Uses in-memory DB for testing, file-based for production
const db = new sqlite3.Database(process.env.DB_PATH || ":memory:");

db.serialize(() => {
  db.exec(schema);
});

// Re-initialize database (mainly used in tests to clear old data)
const initializeDatabase = () => {
  return new Promise((resolve, reject) => {
    db.exec(schema, (err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

// Convert SQLite callbacks to Promises - much easier to work with async/await
// INSERT, UPDATE, DELETE operations
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      // Return both the new row ID and number of affected rows
      resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

// SELECT single row (returns undefined if no match)
function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

// SELECT multiple rows (returns empty array if no matches)
function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// Export functions with aliases for consistency across the codebase
// Controllers use the dbRun/dbGet/dbAll names, so we support both conventions
module.exports = { 
  db, 
  run, 
  get, 
  all,
  dbRun: run,
  dbGet: get,
  dbAll: all,
  initializeDatabase
};
