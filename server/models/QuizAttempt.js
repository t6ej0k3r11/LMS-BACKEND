const mongoose = require("mongoose");

const AnswerSchema = new mongoose.Schema({
  questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  answer: { type: String, required: true },
  isCorrect: { type: Boolean }, // null for broad-text questions that need review
  pointsEarned: { type: Number, default: 0 },
  needsReview: { type: Boolean, default: false }, // true for broad-text questions
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // instructor who reviewed
  reviewDate: { type: Date },
  reviewNotes: { type: String },
});

const QuizAttemptSchema = new mongoose.Schema(
  {
    quizId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
      required: true,
    },
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    attemptNumber: { type: Number, required: true },
    answers: [AnswerSchema],
    score: { type: Number, default: 0 }, // percentage
    totalPoints: { type: Number, required: true },
    pointsEarned: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["in_progress", "completed"],
      default: "in_progress",
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    timeSpent: { type: Number, default: 0 }, // in seconds
  },
  { timestamps: true }
);

// Add indexes for frequently queried fields
QuizAttemptSchema.index({ quizId: 1 });
QuizAttemptSchema.index({ studentId: 1 });
QuizAttemptSchema.index({ courseId: 1 });
QuizAttemptSchema.index({ status: 1 });

// Ensure only one active attempt per student per quiz
QuizAttemptSchema.index(
  { quizId: 1, studentId: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "in_progress" },
    name: "unique_active_quiz_attempt",
  }
);

module.exports = mongoose.model("QuizAttempt", QuizAttemptSchema);
