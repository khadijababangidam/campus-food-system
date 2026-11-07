/**
 * Shared password hashing helper. Extracted from authService so
 * adminService (admin-created vendor accounts) doesn't duplicate the
 * bcrypt salt-rounds constant — one place decides how passwords are
 * hashed, everywhere else just calls it.
 */
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;

async function hashPassword(plainPassword) {
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function comparePassword(plainPassword, hash) {
  return bcrypt.compare(plainPassword, hash);
}

module.exports = { hashPassword, comparePassword };
