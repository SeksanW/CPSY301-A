//database connection pool setup using mysql2/promise, 
// allowing for efficient handling of multiple concurrent database connections in the ARIS LIMS API server.
//  Connection details are loaded from environment variables for security and flexibility.

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
