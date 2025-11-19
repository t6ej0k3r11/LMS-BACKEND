const User = require("../../models/User");
const PasswordResetToken = require("../../models/PasswordResetToken");
const jwt = require("jsonwebtoken");
const crypto = require('crypto');
const { sendPasswordResetEmail } = require('../../utils/emailService');

// Password strength validation function
const validatePasswordStrength = (password) => {
  const errors = [];

  // Length check
  if (password.length < 8) {
    errors.push("Password must be at least 8 characters long");
  }

  // Character variety
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSpecial = /[@$!%*?&]/.test(password);

  const varietyCount = [hasLower, hasUpper, hasDigit, hasSpecial].filter(
    Boolean
  ).length;
  if (varietyCount < 4) {
    errors.push(
      "Password must include uppercase, lowercase, digits, and special characters (@$!%*?&)"
    );
  }

  // Avoid common patterns
  const repeatedChars = /(.)\1{2,}/.test(password);
  if (repeatedChars) {
    errors.push("Password should not contain repeated characters");
  }

  // Basic dictionary word check
  const commonWords = [
    "password",
    "123456",
    "qwerty",
    "admin",
    "user",
    "login",
  ];
  const lowerPassword = password.toLowerCase();
  const hasCommonWord = commonWords.some((word) =>
    lowerPassword.includes(word)
  );
  if (hasCommonWord) {
    errors.push("Password should not contain common words");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const registerUser = async (req, res) => {
  const { userName, userEmail, password, role } = req.body;

  // Check for missing required fields
  if (!userName || !userEmail || !password || !role) {
    return res.status(400).json({
      success: false,
      message: "All fields (userName, userEmail, password, role) are required",
    });
  }

  // Validate role
  const validRoles = ["student", "instructor", "admin"];
  if (!validRoles.includes(role)) {
    return res.status(400).json({
      success: false,
      message: "Invalid role. Must be one of: student, instructor, admin",
    });
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(password);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: "Password does not meet security requirements",
      errors: passwordValidation.errors.map((error) => ({
        field: "password",
        message: error,
      })),
    });
  }

  try {
    const existingUser = await User.findOne({
      $or: [{ userEmail }, { userName }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User name or user email already exists",
      });
    }

    const newUser = new User({
      userName,
      userEmail,
      role,
      password, // Password will be hashed by pre-save middleware
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: "User registered successfully!",
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
    });
  }
};

const loginUser = async (req, res) => {
  const { userEmail, password } = req.body;

  try {
    const checkUser = await User.findOne({ userEmail });

    if (!checkUser || !(await checkUser.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    const accessToken = jwt.sign(
      {
        _id: checkUser._id,
        userName: checkUser.userName,
        userEmail: checkUser.userEmail,
        role: checkUser.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" } // Short-lived access token
    );

    const refreshToken = jwt.sign(
      {
        _id: checkUser._id,
      },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: "7d" } // Long-lived refresh token
    );

    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      data: {
        accessToken,
        refreshToken,
        user: {
          _id: checkUser._id,
          userName: checkUser.userName,
          userEmail: checkUser.userEmail,
          role: checkUser.role,
        },
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed. Please try again.",
    });
  }
};

const refreshAccessToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      success: false,
      message: "Refresh token is required",
    });
  }

  try {
    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    const user = await User.findById(decoded._id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const newAccessToken = jwt.sign(
      {
        _id: user._id,
        userName: user.userName,
        userEmail: user.userEmail,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.status(200).json({
      success: true,
      message: "Token refreshed successfully",
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token",
    });
  }
};

// Request password reset
const requestPasswordReset = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  try {
    // Don't reveal if the email exists or not
    const user = await User.findOne({ userEmail: email.toLowerCase() });
    
    if (user) {
      // Generate a reset token
      const token = await PasswordResetToken.generateToken();
      
      // Save the token to the database
      await PasswordResetToken.create({
        userId: user._id,
        token,
      });

      // Send email with reset link
      const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
      await sendPasswordResetEmail(user.userEmail, resetLink);
    }

    // Always return success to prevent user enumeration
    res.status(200).json({
      success: true,
      message: "If an account with that email exists, a password reset link has been sent",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    res.status(500).json({
      success: false,
      message: "Error processing password reset request",
    });
  }
};

// Reset password with token
const resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Token and new password are required",
    });
  }

  // Validate password strength
  const passwordValidation = validatePasswordStrength(newPassword);
  if (!passwordValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: "Password does not meet security requirements",
      errors: passwordValidation.errors,
    });
  }

  try {
    // Find the token
    const resetToken = await PasswordResetToken.findOne({ 
      token,
      used: false,
      expiresAt: { $gt: new Date() },
    });

    if (!resetToken) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    // Find the user
    const user = await User.findById(resetToken.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update the password
    user.password = newPassword;
    await user.save();

    // Mark token as used
    resetToken.used = true;
    await resetToken.save();

    // Invalidate all user's sessions (optional)
    // This would require additional implementation to track active sessions

    res.status(200).json({
      success: true,
      message: "Password has been reset successfully",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({
      success: false,
      message: "Error resetting password",
    });
  }
};

module.exports = { 
  registerUser, 
  loginUser, 
  refreshAccessToken, 
  requestPasswordReset, 
  resetPassword 
};
