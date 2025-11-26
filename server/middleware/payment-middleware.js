// Rate limiting for payment initialization
const paymentInitRateLimit = (req, res, next) => {
  // Simple in-memory rate limiting (for production, use Redis or similar)
  const clientIP = req.ip || req.connection.remoteAddress;
  const userId = req.user ? req.user._id : null;
  const key = userId || clientIP;

  // Initialize rate limit store if not exists
  if (!global.paymentRateLimit) {
    global.paymentRateLimit = new Map();
  }

  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 5; // 5 payment init requests per 15 minutes

  const userRequests = global.paymentRateLimit.get(key) || [];

  // Filter out requests outside the time window
  const validRequests = userRequests.filter(timestamp => now - timestamp < windowMs);

  if (validRequests.length >= maxRequests) {
    return res.status(429).json({
      success: false,
      message: "Too many payment initialization requests. Please try again later.",
      retryAfter: Math.ceil((windowMs - (now - validRequests[0])) / 1000),
    });
  }

  // Add current request timestamp
  validRequests.push(now);
  global.paymentRateLimit.set(key, validRequests);

  next();
};

// Middleware to check if user can make payment for specific course
const checkPaymentEligibility = async (req, res, next) => {
  try {
    const { courseId } = req.body;
    const userId = req.user._id;

    const Payment = require("../models/Payment");
    const Course = require("../models/Course");

    // Check if course exists and is available
    const course = await Course.findById(courseId);
    if (!course || course.status !== "published" || course.approvalStatus !== "approved") {
      return res.status(404).json({
        success: false,
        message: "Course not found or not available for purchase",
      });
    }

    // Check if already enrolled
    const isEnrolled = course.students.some(
      (student) => student.studentId === userId.toString()
    );

    if (isEnrolled) {
      return res.status(400).json({
        success: false,
        message: "You are already enrolled in this course",
      });
    }

    // Check for existing pending payment
    const existingPayment = await Payment.findOne({
      userId,
      courseId,
      paymentStatus: { $in: ["pending", "processing"] },
    });

    if (existingPayment) {
      return res.status(400).json({
        success: false,
        message: "You already have a pending payment for this course",
      });
    }

    // Add course to request for later use
    req.course = course;
    next();
  } catch (error) {
    console.error("Payment eligibility check error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to check payment eligibility",
    });
  }
};

module.exports = {
  paymentInitRateLimit,
  checkPaymentEligibility,
};