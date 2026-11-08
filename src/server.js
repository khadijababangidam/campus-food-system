require('dotenv').config();

const app = require('./app');
const { verifyConnection } = require('./config/db');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    await verifyConnection();
    console.log('Database connection verified.');

    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`GSU Campus Food System API running on port ${PORT}`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use. Please wait a moment for the previous instance to release it.`);
        process.exit(1);
      } else {
        console.error('Server encountered an unexpected error:', err);
        process.exit(1);
      }
    });

  } catch (err) {
    console.error(
      'Failed to start server — database connection failed:',
      err.message
    );
    process.exit(1);
  }
}

start();
