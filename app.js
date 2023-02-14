const http = require('http');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'your_database_user',
  host: 'your_database_host',
  database: 'your_database_name',
  password: 'your_database_password',
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
});

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/') {
    try {
      const client = await pool.connect();
      const result = await client.query('SELECT $1::text as message', ['Hello, world!']);
      const message = result.rows[0].message;
      client.release();

      res.setHeader('Content-Type', 'text/plain');
      res.end(message);
    } catch (err) {
      console.error('Error executing query', err.stack);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  } else {
    res.statusCode = 404;
    res.end('Not found');
  }
});

server.listen(3000, () => {
  console.log('Server is listening on port 3000');
});
