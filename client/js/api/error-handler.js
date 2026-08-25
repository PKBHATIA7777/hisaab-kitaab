/**
 * Centralised error classification.
 * All UI code receives a typed error object — never parses messages.
 */
const ErrorType = Object.freeze({
  NETWORK:     'NETWORK',
  TIMEOUT:     'TIMEOUT',
  OFFLINE:     'OFFLINE',
  AUTH:        'AUTH',
  FORBIDDEN:   'FORBIDDEN',
  NOT_FOUND:   'NOT_FOUND',
  VALIDATION:  'VALIDATION',
  RATE_LIMIT:  'RATE_LIMIT',
  SERVER:      'SERVER',
  UNKNOWN:     'UNKNOWN',
});

function classifyError(err) {
  if (err.isOffline)       return ErrorType.OFFLINE;
  if (err.isTimeout)       return ErrorType.TIMEOUT;
  if (err.isRateLimit)     return ErrorType.RATE_LIMIT;
  if (err.isServerError)   return ErrorType.SERVER;
  if (err.status === 401)  return ErrorType.AUTH;
  if (err.status === 403)  return ErrorType.FORBIDDEN;
  if (err.status === 404)  return ErrorType.NOT_FOUND;
  if (err.status === 400)  return ErrorType.VALIDATION;
  if (!navigator.onLine)   return ErrorType.OFFLINE;
  return ErrorType.UNKNOWN;
}

const USER_MESSAGES = {
  [ErrorType.NETWORK]:    'Connection problem. Please check your network.',
  [ErrorType.TIMEOUT]:    'Server is waking up. Please try again.',
  [ErrorType.OFFLINE]:    'You are offline.',
  [ErrorType.AUTH]:       'Session expired. Redirecting to login.',
  [ErrorType.FORBIDDEN]:  "You don't have permission to do that.",
  [ErrorType.NOT_FOUND]:  'This item no longer exists.',
  [ErrorType.VALIDATION]: null,  // use server message
  [ErrorType.RATE_LIMIT]: 'Too many requests. Please wait a moment.',
  [ErrorType.SERVER]:     'Something went wrong on our end. Please try again.',
  [ErrorType.UNKNOWN]:    'Something went wrong. Please try again.',
};

function getUserMessage(err) {
  const type = classifyError(err);
  return USER_MESSAGES[type] || err.message || USER_MESSAGES[ErrorType.UNKNOWN];
}

function handleApiError(err, context = '') {
  const type = classifyError(err);
  const message = getUserMessage(err);
  
  if (context && window.APP_CONFIG?.isLocal) {
    console.error(`[${context}]`, err);
  }
  
  return { type, message, original: err };
}

window.ErrorType   = ErrorType;
window.handleApiError = handleApiError;
window.getUserMessage = getUserMessage;