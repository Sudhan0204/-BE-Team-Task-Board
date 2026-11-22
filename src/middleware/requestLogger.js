import morgan from 'morgan';
import logger from '../config/logger.js';
import env from '../config/env.js';

// Custom format for morgan to output concise structured HTTP log
const morganFormat = env.isDevelopment ? 'dev' : 'combined';

// Stream that pipes morgan logs to our structured logger
const stream = {
  write: (message) => {
    logger.info(message.trim());
  },
};

// Skip logging health check polling in production to keep logs clean
const skip = (req) => {
  return req.url === '/api/v1/health' && env.isProduction;
};

export const requestLogger = morgan(morganFormat, { stream, skip });

export default requestLogger;
