// @ts-nocheck
const mongoose = require("mongoose");

const QuestionSchema = new mongoose.Schema({
  mode: { type: String, enum: ["custom", "bank"], default: "custom" }, // custom or bank reference
  bankQuestionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "QuestionBank",
    default: null,
  }, // reference to question bank
  type: { type: String, required: true }, // e.g., 'multiple-choice', 'true-false', 'broad-text'
  question: { type: String, required: true },
  options: [{ type: String }], // array of options for multiple choice
  correctAnswer: { type: String }, // required for multiple-choice, optional for broad-text (sample answer)
  correctAnswerIndex: { type: Number, default: null },
  points: { type: Number, default: 1 },
  requiresReview: { type: Boolean, default: false }, // true for broad-text questions
  explanation: { type: String }, // explanation for the correct answer
  tags: [{ type: String }], // for bank questions
  subject: { type: String }, // for bank questions
  difficulty: { type: String, enum: ["easy", "medium", "hard"] }, // for bank questions
});

const QuizSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    prerequisiteLectureIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Lecture",
      },
    ], // empty for final quiz
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
    instantFeedbackEnabled: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    isValid: { type: Boolean, default: true }, // true if all questions are valid
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
