const User = require("../models/User");

const checkInstructorApproved = async (req, res, next) => {
  console.log(
    "checkInstructorApproved: Checking instructor approval for",
    req.path
  );
  // Check if user is authenticated (this should be checked by auth middleware first)
  if (!req.user) {
    console.log("checkInstructorApproved: No req.user");
    return res.status(401).json({
      success: false,
      message: "Authentication required",
    });
  }

  try {
    // Fetch the user from DB to get current status
    const user = await User.findById(req.user._id);
    console.log("checkInstructorApproved: User found =", {
      _id: user._id,
      role: user.role,
      instructorStatus: user.instructorStatus,
    });
    if (!user) {
      console.log("checkInstructorApproved: User not found");
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is an instructor
    if (user.role !== "instructor") {
      console.log(
        "checkInstructorApproved: User is not instructor, role =",
        user.role
      );
      return res.status(403).json({
        success: false,
        message: "Access denied. Instructor role required.",
      });
    }

    // Check if instructor is approved
    if (user.instructorStatus !== "approved") {
      console.log(
        "checkInstructorApproved: Instructor not approved, status =",
        user.instructorStatus
      );
      return res.status(403).json({
        success: false,
        message: "Instructor account is pending approval",
      });
    }

    console.log("checkInstructorApproved: Instructor approved, proceeding");
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
