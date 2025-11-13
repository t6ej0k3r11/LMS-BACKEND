const { body, validationResult } = require("express-validator");

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: errors.array().map((err) => ({
        field: err.path,
        message: err.msg,
        value: err.value,
      })),
    });
  }
  next();
};

// Validation rules for user registration
const validateRegistration = [
  body("userName")
    .trim()
    .isLength({ min: 3, max: 50 })
    .withMessage("Username must be between 3 and 50 characters")
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage("Username can only contain letters, numbers, and underscores"),

  body("userEmail")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),

  body("password")
    .isLength({ min: 8 })
    .withMessage("Password must be at least 8 characters long")
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])/)
    .withMessage(
      "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character"
    ),

  body("role")
    .isIn(["student", "instructor", "admin"])
    .withMessage("Role must be either student, instructor, or admin"),

  handleValidationErrors,
];

// Validation rules for user login
const validateLogin = [
  body("userEmail")
    .isEmail()
    .normalizeEmail()
    .withMessage("Please provide a valid email address"),

  body("password").notEmpty().withMessage("Password is required"),

  handleValidationErrors,
];

// Validation rules for course creation
const validateCourseCreation = [
  body("title")
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage("Course title must be between 5 and 100 characters"),

  body("description")
    .trim()
    .isLength({ min: 20, max: 1000 })
    .withMessage("Course description must be between 20 and 1000 characters"),

  body("category").trim().notEmpty().withMessage("Category is required"),

  body("level")
    .isIn(["beginner", "intermediate", "advanced"])
    .withMessage("Level must be beginner, intermediate, or advanced"),

  body("pricing")
    .isFloat({ min: 0 })
    .withMessage("Price must be a positive number"),

  handleValidationErrors,
];

// Validation rules for quiz creation
const validateQuizCreation = [
  body("title")
    .trim()
    .isLength({ min: 5, max: 100 })
    .withMessage("Quiz title must be between 5 and 100 characters"),

  body("description")
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage("Quiz description must not exceed 500 characters"),

  body("courseId").isMongoId().withMessage("Valid course ID is required"),

  body("lectureId")
    .optional()
    .isMongoId()
    .withMessage("Valid lecture ID is required if provided"),

  body("quizType")
    .isIn(["lesson", "final"])
    .withMessage("Quiz type must be either 'lesson' or 'final'"),

  body("passingScore")
    .isFloat({ min: 0, max: 100 })
    .withMessage("Passing score must be between 0 and 100"),

  body("timeLimit")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Time limit must be a positive integer in minutes"),

  body("attemptsAllowed")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Attempts allowed must be a positive integer"),

  body("isActive")
    .optional()
    .isBoolean()
    .withMessage("isActive must be a boolean"),

  body("questions")
    .isArray({ min: 1 })
    .withMessage("At least one question is required"),

  body("questions.*.type")
    .isIn(["multiple-choice", "true-false", "broad-text"])
    .withMessage(
      "Question type must be 'multiple-choice', 'true-false', or 'broad-text'"
    ),

  body("questions.*.question")
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage("Question text must be between 10 and 500 characters"),

  body("questions.*.options")
    .optional()
    .isArray()
    .withMessage("Options must be an array if provided"),

  body("questions.*.correctAnswer")
    .optional()
    .isString()
    .trim()
    .notEmpty()
    .withMessage("Correct answer must be a non-empty string if provided"),

  body("questions.*.points")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Points must be a positive integer"),

  body("questions.*.requiresReview")
    .optional()
    .isBoolean()
    .withMessage("Requires review must be a boolean"),

  handleValidationErrors,
];

// Validation rules for quiz submission
const validateQuizSubmission = [
  body("answers").isArray().withMessage("Answers must be an array"),

  body("answers.*.questionId")
    .isMongoId()
    .withMessage("Valid question ID is required"),

  body("answers.*.answer").exists().withMessage("Answer is required"),

  handleValidationErrors,
];

// Validation rules for course progress update
const validateProgressUpdate = [
  body("userId").isMongoId().withMessage("Valid user ID is required"),

  body("courseId").isMongoId().withMessage("Valid course ID is required"),

  body("lectureId").isMongoId().withMessage("Valid lecture ID is required"),

  body("progressValue")
    .optional()
    .isFloat({ min: 0, max: 1 })
    .withMessage("Progress value must be between 0 and 1"),

  body("isRewatch")
    .optional()
    .isBoolean()
    .withMessage("isRewatch must be a boolean"),

  handleValidationErrors,
];

module.exports = {
  validateRegistration,
  validateLogin,
  validateCourseCreation,
  validateQuizCreation,
  validateQuizSubmission,
  validateProgressUpdate,
  handleValidationErrors,
};
