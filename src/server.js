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
        console.warn(`Port ${PORT} is busy. Retrying in 3 seconds...`);
        setTimeout(() => {
          server.close(() => {
            start();
          });
        }, 3000);
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
    console.log('Retrying connection in 5 seconds...');
    setTimeout(start, 5000);
  }
}

start();
