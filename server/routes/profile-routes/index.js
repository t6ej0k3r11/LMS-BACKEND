const express = require("express");
const multer = require("multer");
const {
  getProfile,
  updateProfile,
  updateNotificationPreferences,
  changePassword,
  deleteAccount,
} = require("../../controllers/profile-controller");
const { authenticate } = require("../../middleware/auth-middleware");
const { uploadMediaToCloudinary } = require("../../helpers/cloudinary");

const router = express.Router();

// All profile routes require authentication
router.use(authenticate);

const upload = multer({ dest: "uploads/" });

// Upload avatar
router.post("/avatar", upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No avatar file provided",
      });
    }

    // File type validation (images only)
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed",
      });
    }

    // File size validation (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB in bytes
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size allowed is 5MB",
      });
    }

    const result = await uploadMediaToCloudinary(req.file.path);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Avatar upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error uploading avatar",
    });
  }
});

// Get user profile data
router.get("/", getProfile);

// Update user profile
router.put("/", updateProfile);

// Update notification preferences
router.put("/notifications", updateNotificationPreferences);

// Change password
router.put("/password", changePassword);

// Delete account
router.delete("/account", deleteAccount);

module.exports = router;
