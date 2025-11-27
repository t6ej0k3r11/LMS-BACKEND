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
const { validateImage, createFileFilter, createLimits } = require("../../middleware/fileValidation");

const router = express.Router();

// All profile routes require authentication
router.use(authenticate);

// Configure multer for avatar uploads
const upload = multer({
  dest: "uploads/",
  fileFilter: createFileFilter(['image']),
  limits: createLimits(['image'])
});

// Upload avatar
router.post("/avatar", upload.single("avatar"), validateImage, async (req, res) => {
  try {
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
