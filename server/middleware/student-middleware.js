const studentMiddleware = (req, res, next) => {
  // Check if user is authenticated (this should be checked by auth middleware first)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Check if user is a student
  if (req.user.role !== "student") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Student role required.",
    });
  }

  // User is a student, proceed
  next();
};

module.exports = {
  studentMiddleware,
};