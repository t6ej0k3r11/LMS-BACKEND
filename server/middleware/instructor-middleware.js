const checkInstructorApproved = (req, res, next) => {
  // Check if user is authenticated (this should be checked by auth middleware first)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Check if user is an instructor
  if (req.user.role !== "instructor") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Instructor role required.",
    });
  }

  // Check if instructor is approved
  if (req.user.status !== "approved") {
    return res.status(403).json({
      success: false,
      message: "Your account is waiting for admin approval.",
    });
  }

  // User is approved instructor, proceed
  next();
};

const checkInstructorRole = (req, res, next) => {
  // Check if user is authenticated (this should be checked by auth middleware first)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  // Check if user is an instructor (any status)
  if (req.user.role !== "instructor") {
    return res.status(403).json({
      success: false,
      message: "Access denied. Instructor role required.",
    });
  }

  // User is instructor, proceed (regardless of approval status)
  next();
};

module.exports = {
  checkInstructorApproved,
  checkInstructorRole,
};
