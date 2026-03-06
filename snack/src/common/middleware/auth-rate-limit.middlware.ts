import rateLimit from 'express-rate-limit';

export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: 'Too many authentication attempts. Please try again later.',
  },
});
