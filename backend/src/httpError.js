'use strict';

class HttpError extends Error {
  /**
   * @param {number} status
   * @param {string} message
   * @param {object} [details] extra fields merged into the JSON error body
   */
  constructor(status, message, details) {
    super(message);
    this.name    = 'HttpError';
    this.status  = status;
    this.details = details;
  }
}

const badRequest = (msg, details) => new HttpError(400, msg, details);
const notFound   = (msg, details) => new HttpError(404, msg, details);
const conflict   = (msg, details) => new HttpError(409, msg, details);

module.exports = { HttpError, badRequest, notFound, conflict };
