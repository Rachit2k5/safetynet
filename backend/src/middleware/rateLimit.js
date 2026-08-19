import rateLimit from 'express-rate-limit';

export const panicLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5 });
export const checkinLimiter = rateLimit({ windowMs: 60 * 1000, limit: 10 });
export const contactLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 });
export const pushLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 });
export const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 200 });