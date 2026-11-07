/**
 * Category service. Deliberately thin: categories are a fixed, seeded
 * reference list for MVP scope (Section 3.7) — no vendor-suggestion or
 * admin-moderation workflow. If that changes later, it's a new migration
 * plus new methods here, not a rewrite of this file's shape.
 */
const categoryRepository = require('../repositories/categoryRepository');

async function listAll() {
  return categoryRepository.listAll();
}

module.exports = { listAll };
