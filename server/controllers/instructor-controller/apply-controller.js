const User = require("../../models/User");

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

  const sequentialChars =
    /(?:012|123|234|345|456|567|678|789|890|abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|Abc|Def)/i.test(
      password
    );
  if (sequentialChars) {
    errors.push("Password should not contain sequential characters");
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

const applyForInstructor = async (req, res) => {
  const { userName, userEmail, password, bio, experience } = req.body;

  // Check for missing required fields
  if (!userName || !userEmail || !password || !bio) {
    return res.status(400).json({
      success: false,
      message: "All fields (userName, userEmail, password, bio) are required",
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
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ userEmail: userEmail.toLowerCase() }, { userName }],
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "A user with this email or username already exists",
      });
    }

    const newUser = new User({
      userName,
      userEmail: userEmail.toLowerCase(),
      password,
      role: "instructor",
      instructorStatus: "pending",
      application: {
        bio,
        experience: experience || "",
        submittedAt: new Date(),
      },
    });

    await newUser.save();

    return res.status(201).json({
      success: true,
      message:
        "Your instructor application has been submitted successfully and is pending approval.",
    });
  } catch (error) {
    console.error("Instructor application error:", error);
    return res.status(500).json({
      success: false,
      message: "Application submission failed. Please try again.",
    });
  }
};

module.exports = {
  applyForInstructor,
};
