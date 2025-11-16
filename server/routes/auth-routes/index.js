const express = require("express");
const {
  registerUser,
  loginUser,
  refreshAccessToken,
  requestPasswordReset,
  resetPassword,
} = require("../../controllers/auth-controller/index");
const authenticateMiddleware = require("../../middleware/auth-middleware");
const {
  validateRegistration,
  validateLogin,
  validatePasswordResetRequest,
  validatePasswordReset,
} = require("../../middleware/validation-middleware");
const router = express.Router();

// Authentication routes
router.post("/register", validateRegistration, registerUser);
router.post("/login", validateLogin, loginUser);
router.post("/refresh-token", refreshAccessToken);

// Password reset routes
router.post("/request-reset", validatePasswordResetRequest, requestPasswordReset);
router.post("/reset-password", validatePasswordReset, resetPassword);

// Check authentication status
router.get("/check-auth", authenticateMiddleware.authenticate, (req, res) => {
  const user = req.user;

  res.status(200).json({
    success: true,
    message: "Authenticated user!",
    data: {
      user,
    },
  });
});

module.exports = router;
