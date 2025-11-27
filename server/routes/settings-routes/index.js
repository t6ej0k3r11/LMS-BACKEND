const express = require("express");
const multer = require("multer");
const {
  getUserSettings,
  updateUserSettings,
  uploadProfilePicture,
  uploadCoverImage,
} = require("../../controllers/settings-controller");
const { authenticate } = require("../../middleware/auth-middleware");

const router = express.Router();

// All settings routes require authentication
router.use(authenticate);

const upload = multer({ dest: "uploads/" });

// Get current user settings
router.get("/me", getUserSettings);

// Update user settings
router.put("/update", updateUserSettings);

// Upload profile picture
router.post("/upload-profile", upload.single("profile"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No profile file provided",
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

    // Call the controller function
    await uploadProfilePicture(req, res);
  } catch (error) {
    console.error("Profile upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error uploading profile picture",
    });
  }
});

// Upload cover image (instructor only)
router.post("/upload-cover", upload.single("cover"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No cover file provided",
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

    // File size validation (10MB limit for cover images)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (req.file.size > maxSize) {
      return res.status(400).json({
        success: false,
        message: "File too large. Maximum size allowed is 10MB",
      });
    }

    // Call the controller function
    await uploadCoverImage(req, res);
  } catch (error) {
    console.error("Cover upload error:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Error uploading cover image",
    });
  }
});

module.exports = router;
