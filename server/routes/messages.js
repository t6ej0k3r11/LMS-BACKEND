const express = require("express");
const User = require("../models/User");
const authenticateMiddleware = require("../middleware/auth-middleware");

const router = express.Router();

// All message routes require authentication
router.use(authenticateMiddleware.authenticate);

/**
 * Get chat partners based on user role
 * Student: all instructors
 * Instructor: all students
 * Admin: all users
 */
router.get("/partners", async (req, res) => {
  try {
    const userRole = req.user.role;
    let query = {};

    if (userRole === "student") {
      query = { role: "instructor" };
    } else if (userRole === "instructor") {
      query = { role: "student" };
    } else if (userRole === "admin") {
      // Admin gets all users
      query = {};
    } else {
      return res.status(400).json({
        success: false,
        message: "Invalid user role",
      });
    }

    const partners = await User.find(query).select("userName userEmail role");

    const formattedPartners = partners.map((partner) => ({
      name: partner.userName,
      role: partner.role,
      email: partner.userEmail,
    }));

    res.status(200).json({
      success: true,
      partners: formattedPartners,
    });
  } catch (error) {
    console.error("Get partners error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve partners",
    });
  }
});

module.exports = router;
