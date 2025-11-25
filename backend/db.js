const mysql = require('mysql2/promise');

const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'likki@8585',
  database: 'dropin'
});

module.exports = db;
