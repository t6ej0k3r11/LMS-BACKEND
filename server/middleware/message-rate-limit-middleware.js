const rateLimit = require("express-rate-limit");

// Rate limiter for message sending
const messageRateLimit = rateLimit({
  windowMs: 3 * 1000, // 3 seconds
  max: 3, // Limit each IP to 3 requests per windowMs
  message: {
    success: false,
    message: "Too many messages sent; slow down.",
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Use IP address for rate limiting with IPv6 support
  keyGenerator: rateLimit.ipKeyGenerator,
  // Skip successful requests and only count failures
  skipSuccessfulRequests: false,
  // Skip failed requests and only count successes
  skipFailedRequests: false,
});

module.exports = {
  messageRateLimit,
};
