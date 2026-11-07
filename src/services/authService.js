/**
 * Auth service — business rules for registration and login.
 * Contains no Express-specific code (no req/res) so it can be unit tested
 * in isolation and reused if a different delivery mechanism is added later.
 */
const jwt = require('jsonwebtoken');
const userRepository = require('../repositories/userRepository');
const { hashPassword, comparePassword } = require('../utils/password');

// Vendor and admin accounts are provisioned by an administrator, not
// self-registered (System Assumptions, Section 3.9) — enforced here, not
// just at the UI level, since the API must not trust the client.
const SELF_REGISTERABLE_ROLES = ['student', 'staff', 'rider'];

class AuthError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

async function register({ fullName, email, phone, password, role }) {
  if (!SELF_REGISTERABLE_ROLES.includes(role)) {
    throw new AuthError(
      'This role cannot be self-registered. Vendor and admin accounts are created by an administrator.',
      403
    );
  }

  const existing = await userRepository.findByEmail(email);
  if (existing) {
    throw new AuthError('An account with this email already exists', 409);
  }

  const passwordHash = await hashPassword(password);
  const user = await userRepository.create({ fullName, email, phone, passwordHash, role });
  return user;
}

async function login({ email, password }) {
  const user = await userRepository.findByEmail(email);
  if (!user) {
    // Deliberately vague — don't reveal whether the email exists.
    throw new AuthError('Invalid email or password', 401);
  }

  const passwordMatches = await comparePassword(password, user.password_hash);
  if (!passwordMatches) {
    throw new AuthError('Invalid email or password', 401);
  }

  // Checked only after a correct password, so a wrong-password attempt
  // against a suspended account looks identical to one against an active
  // account — suspension status isn't discoverable by guessing.
  if (!user.is_active) {
    throw new AuthError('Your account has been suspended. Contact an administrator.', 403);
  }

  const token = jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );

  return {
    token,
    user: {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      role: user.role,
    },
  };
}

module.exports = { register, login, AuthError };
