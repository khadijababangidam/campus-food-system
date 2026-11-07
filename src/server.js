require('dotenv').config();
const app = require('./app');
const { verifyConnection } = require('./config/db');

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`GSU Campus Food System API running on port ${PORT}`);
});

async function start() {
  try {
    await verifyConnection();
    console.log('Database connection verified.');

    app.listen(PORT, () => {
      console.log(`GSU Campus Food System API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server — database connection failed:', err.message);
    process.exit(1);
  }
}

start();
