require('dotenv').config();
const app = require('./app');
const { verifyConnection } = require('./config/db');

const PORT = process.env.PORT || 3000;
const MAX_DB_RETRIES = 10;
let server;

async function connectDb(attempt = 1) {
  try {
    await verifyConnection();
    console.log('Database connection verified.');
  } catch (err) {
    if (attempt >= MAX_DB_RETRIES) {
      console.error('Database unreachable, giving up:', err.message);
      process.exit(1);
    }
    console.warn(`DB connection failed (${attempt}/${MAX_DB_RETRIES}): ${err.message}. Retrying in 5s...`);
    await new Promise((r) => setTimeout(r, 5000));
    return connectDb(attempt + 1);
  }
}

async function start() {
  await connectDb();

  server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`GSU Campus Food System API running on port ${PORT} (PID ${process.pid})`);
  });

  server.on('error', (err) => {
    console.error('Server error:', err.code, err.message);
    process.exit(1);
  });
}

function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  if (!server) return process.exit(0);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();