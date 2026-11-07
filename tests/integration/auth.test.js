const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db'); // Adjust this path if your db config file is located elsewhere

describe('Authentication API Integration Tests', () => {
  // Use a dynamic timestamp to avoid duplicate key conflicts on multiple runs
  const timestamp = Date.now();
  const testUser = {
    fullName: 'Test Student',
    email: `test.student.${timestamp}@gsu.edu.ng`,
    phone: `080${Math.floor(10000000 + Math.random() * 90000000)}`,
    role: 'student',
    password: 'Password123!',
  };

  it('should successfully register a new student user', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send(testUser);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('data');
  });

  it('should log in the registered student and return a JWT token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('data');
    expect(response.body.data).toHaveProperty('token');
    expect(response.body.data.user.email).toBe(testUser.email);
    expect(response.body.data.user.role).toBe('student');
  });

  it('should reject login attempts with an invalid password', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: testUser.email,
        password: 'IncorrectPassword!',
      });

    expect(response.status).toBe(401);
  });

  // Gracefully close the database connection pool so Jest exits without warnings.
  // db.js exports { pool, verifyConnection } — the pool itself carries .end(),
  // not the module object, so this must go through db.pool, not db directly.
  afterAll(async () => {
    if (db && db.pool && typeof db.pool.end === 'function') {
      await db.pool.end();
    }
  });
});
