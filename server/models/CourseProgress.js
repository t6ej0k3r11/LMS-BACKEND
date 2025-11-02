const mongoose = require("mongoose");

const LectureProgressSchema = new mongoose.Schema({
  lectureId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  viewed: Boolean,
  dateViewed: Date,
});

const QuizProgressSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  completed: Boolean,
  bestScore: Number,
  attempts: Number,
  lastAttemptDate: Date,
});

const CourseProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
  completed: Boolean,
  completionDate: Date,
  lecturesProgress: [LectureProgressSchema],
  quizzesProgress: [QuizProgressSchema],
});

// Add indexes for frequently queried fields
CourseProgressSchema.index({ userId: 1 });
CourseProgressSchema.index({ courseId: 1 });
CourseProgressSchema.index({ completed: 1 });

module.exports = mongoose.model("Progress", CourseProgressSchema);
