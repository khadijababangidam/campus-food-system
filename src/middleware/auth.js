/**
 * Authentication and RBAC middleware (FR1, FR10; NFR Security).
 * `authenticate` verifies the JWT and attaches the decoded payload to req.user.
 * `authorize(...roles)` is applied per-route to enforce role-based access,
 * so authorization is declared explicitly at each route rather than assumed.
 */
const jwt = require('jsonwebtoken');

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Authentication token required' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { sub: userId, role }
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Insufficient permissions for this action' });
    }
    return next();
  };
}

module.exports = { authenticate, authorize };
