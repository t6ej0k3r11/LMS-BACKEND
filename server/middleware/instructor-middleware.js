const User = require("../models/User");

const checkInstructorApproved = async (req, res, next) => {
  // Check if user is authenticated (this should be checked by auth middleware first)
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    // Fetch the user from DB to get current status
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is an instructor
    if (user.role !== "instructor") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Instructor role required.",
      });
    }

    // Check if instructor is approved
    if (user.instructorStatus !== "approved") {
      return res.status(403).json({
        success: false,
        message: "Instructor account is pending approval",
      });
    }

    // User is approved instructor, proceed
    next();
  } catch (error) {
    console.error("Error in checkInstructorApproved middleware:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
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
