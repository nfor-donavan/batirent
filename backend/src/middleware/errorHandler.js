const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.originalUrl} not found`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let code = err.code;
  let details = err.details;

  if (err.name === 'ValidationError') { status = 422; code = 'VALIDATION'; details = Object.keys(err.errors); }
  else if (err.name === 'CastError') { status = 404; code = 'NOT_FOUND'; }
  else if (err.code === 11000) { status = 409; code = 'DUPLICATE'; details = err.keyValue; }
  else if (err.name === 'MulterError') { status = 400; code = err.code === 'LIMIT_FILE_SIZE' ? 'PHOTO_TOO_LARGE' : 'UPLOAD_ERROR'; }
  else if (code === 'PHOTO_TYPE') { status = 415; }
  else if (!(err instanceof AppError)) { code = 'SERVER_ERROR'; }

  if (status >= 500) console.error(err);
  res.status(status).json({ error: { code: code || 'ERROR', message: status >= 500 ? 'Internal server error' : err.message, details } });
}

module.exports = { notFound, errorHandler };
