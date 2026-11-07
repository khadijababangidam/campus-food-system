-- Migration 011: users.is_active
-- Supports admin suspend/reactivate (FR9). Checked at login (authService)
-- so a suspended account can't authenticate even with a correct password;
-- checked AFTER password verification there specifically, so a wrong-
-- password attempt against a suspended account returns the same generic
-- error as any other failed login, rather than leaking suspension status
-- to someone who doesn't already know the password.

ALTER TABLE users
  ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT TRUE AFTER role;
