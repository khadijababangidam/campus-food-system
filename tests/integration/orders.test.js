const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/config/db');

/**
 * This suite creates its own vendor and menu item via the admin API
 * rather than depending on GET /menu already having data — the original
 * version of this test silently skipped its own core assertion whenever
 * the database had no menu items, which meant it effectively never ran
 * on a freshly-migrated/seeded database. Being self-contained means the
 * test is meaningful regardless of what else has been seeded.
 *
 * PRECONDITION: an admin account must already exist (run
 * `npm run seed:admin` against the test database first) — this suite
 * logs in as that admin to create the vendor it needs. If no admin
 * exists, the admin-login step below fails loudly and clearly, rather
 * than silently skipping like the bug this replaces.
 */
describe('Menu & Order API Integration Tests', () => {
  const timestamp = Date.now();

  let studentToken = '';
  let vendorToken = '';
  let testItemId = '';
  let testVendorId = '';

  const studentUser = {
    fullName: 'Order Test Student',
    email: `order.student.${timestamp}@gsu.edu.ng`,
    phone: '08011223344',
    role: 'student',
    password: 'Password123!',
  };

  const newVendor = {
    fullName: `Order Test Vendor Owner ${timestamp}`,
    email: `order.vendor.${timestamp}@gsu.edu.ng`,
    phone: '08022334455',
    password: 'Password123!',
    businessName: `Order Test Vendor ${timestamp}`,
    description: 'Created by the automated order test suite.',
  };

  const newMenuItem = {
    name: `Test Jollof Rice ${timestamp}`,
    description: 'A menu item created solely for automated testing.',
    price: 1500.0,
  };

  beforeAll(async () => {
    // 1. Log in as the pre-existing admin account (see PRECONDITION above).
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@gsu-food.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: adminPassword });

    if (adminLoginRes.status !== 200) {
      throw new Error(
        `Could not log in as admin (${adminEmail}) to set up the order test suite. ` +
        `Did you run "npm run seed:admin" against this test database? ` +
        `Login attempt returned status ${adminLoginRes.status}: ${JSON.stringify(adminLoginRes.body)}`
      );
    }
    const adminToken = adminLoginRes.body.data.token;

    // 2. Create a fresh vendor via the admin-only endpoint — this is the
    //    ONLY way a vendor account can be created in this system.
    const createVendorRes = await request(app)
      .post('/api/v1/admin/vendors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(newVendor);

    if (createVendorRes.status !== 201) {
      throw new Error(
        `Could not create the test vendor. Status ${createVendorRes.status}: ${JSON.stringify(createVendorRes.body)}`
      );
    }
    testVendorId = createVendorRes.body.data.id;

    // 3. Log in as that vendor.
    const vendorLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: newVendor.email, password: newVendor.password });
    vendorToken = vendorLoginRes.body.data.token;

    // 4. Create a menu item as that vendor (categoryId is optional).
    const createItemRes = await request(app)
      .post('/api/v1/menu')
      .set('Authorization', `Bearer ${vendorToken}`)
      .send(newMenuItem);

    if (createItemRes.status !== 201) {
      throw new Error(
        `Could not create the test menu item. Status ${createItemRes.status}: ${JSON.stringify(createItemRes.body)}`
      );
    }
    testItemId = createItemRes.body.data.id;

    // 5. Register and log in the student who will place the order.
    await request(app).post('/api/v1/auth/register').send(studentUser);
    const studentLoginRes = await request(app).post('/api/v1/auth/login').send({
      email: studentUser.email,
      password: studentUser.password,
    });
    studentToken = studentLoginRes.body.data.token;
  });

  it('should fetch the public menu items and include the test item just created', async () => {
    const response = await request(app).get('/api/v1/menu');
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);

    const itemsArray = response.body.data.items;
    expect(Array.isArray(itemsArray)).toBe(true);
    expect(itemsArray.some(item => item.id === testItemId)).toBe(true);
  });

  it('should allow an authenticated student to place an order', async () => {
    const orderPayload = {
      vendorId: testVendorId,
      items: [
        { itemId: testItemId, quantity: 2 }
      ]
    };

    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send(orderPayload);

    expect(response.status).toBe(201);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data.status).toBe('pending');
    // total_amount must be server-computed from the item's real price
    // (1500.00 x 2 = 3000.00), never trusted from the request body.
    expect(Number(response.body.data.total_amount)).toBe(3000);
  });

  it('should reject an order containing an item from a different vendor', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ vendorId: testVendorId + 999999, items: [{ itemId: testItemId, quantity: 1 }] });

    // Either a validation/ownership failure or a "vendor not found" —
    // both are acceptable outcomes here, the point is it must NOT succeed.
    expect(response.status).not.toBe(201);
  });

  afterAll(async () => {
    if (db && db.pool && typeof db.pool.end === 'function') {
      await db.pool.end();
    }
  });
});
