const mongoose = require("mongoose");

const UserCourseProgressSchema = new mongoose.Schema({
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
  completedLessons: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Lecture",
    },
  ],
  videoProgressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  completedQuizzes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
    },
  ],
  overallProgressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  isCompleted: {
    type: Boolean,
    default: false,
  },
  completionDate: {
    type: Date,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  },
});

// Add indexes for frequently queried fields
UserCourseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });
UserCourseProgressSchema.index({ userId: 1 });
UserCourseProgressSchema.index({ courseId: 1 });

module.exports = mongoose.model("UserCourseProgress", UserCourseProgressSchema);
