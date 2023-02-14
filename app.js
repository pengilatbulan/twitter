const http = require('http');
const { Pool } = require('pg');

const pool = new Pool({
  user: 'me',
  host: 'dpg-cfeb7gsgqg46rpn7ao20-a',
  database: 'cakcak',
  password: 'vq7TCgO99HCsu3JNcQmNtoQfLTlFoIwM',
  port: 5432,
  ssl: {
    rejectUnauthorized: false,
  },
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
