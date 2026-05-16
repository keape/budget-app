const isProduction = process.env.NODE_ENV === 'production';

const debugLog = (...args) => {
  if (!isProduction) {
    console.log(...args);
  }
};

const logError = (message, error) => {
  if (isProduction) {
    console.error(message, error?.message || error);
    return;
  }

  console.error(message, error);
};

module.exports = {
  debugLog,
  logError
};
