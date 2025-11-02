const express = require("express");
const {
  registerUser,
  loginUser,
  refreshAccessToken,
} = require("../../controllers/auth-controller/index");
const authenticateMiddleware = require("../../middleware/auth-middleware");
const {
  validateRegistration,
  validateLogin,
} = require("../../middleware/validation-middleware");
const router = express.Router();

router.post("/register", validateRegistration, registerUser);
router.post("/login", validateLogin, loginUser);
router.post("/refresh-token", refreshAccessToken);
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
