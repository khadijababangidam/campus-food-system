/**
 * Central error handler. Every controller calls next(err) on failure
 * instead of formatting error responses itself, so error shape stays
 * consistent across the whole API.
 */
function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const isServerError = statusCode === 500;

  if (isServerError) {
    // Log full detail server-side, never leak internals to the client.
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  }

  res.status(statusCode).json({
    success: false,
    message: isServerError ? 'An unexpected error occurred' : err.message,
  });
}

module.exports = errorHandler;
