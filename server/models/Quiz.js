// @ts-nocheck
const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g., 'multiple-choice', 'true-false', 'broad-text'
  question: { type: String, required: true },
  options: [{ type: String }], // array of options for multiple choice
  correctAnswer: { type: String }, // required for multiple-choice, optional for broad-text (sample answer)
  correctAnswerIndex: { type: Number, default: null },
  points: { type: Number, default: 1 },
  requiresReview: { type: Boolean, default: false }, // true for broad-text questions
});

const QuizSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    lectureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
      default: null,
    }, // null for final quiz
    quizType: {
      type: String,
      enum: ["lesson", "final"],
      required: true,
    },
    title: { type: String, required: true },
    description: { type: String },
    questions: [QuestionSchema],
    passingScore: { type: Number, required: true }, // e.g., 70 for 70%
    timeLimit: { type: Number }, // in minutes
    attemptsAllowed: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  { timestamps: true }
);

// Add indexes for frequently queried fields
QuizSchema.index({ courseId: 1 });
QuizSchema.index({ createdBy: 1 });
QuizSchema.index({ quizType: 1 });
QuizSchema.index({ isActive: 1 });

module.exports = mongoose.model("Quiz", QuizSchema);
