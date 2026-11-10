// Errors carry a stable machine code so the web and mobile apps can translate them (FR/EN).
class AppError extends Error {
  constructor(status, code, message, details) {
    super(message || code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
module.exports = AppError;
