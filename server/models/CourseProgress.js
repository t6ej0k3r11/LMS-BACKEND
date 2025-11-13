const mongoose = require("mongoose");

const LectureProgressSchema = new mongoose.Schema({
  lectureId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  viewed: Boolean,
  dateViewed: Date,
  rewatchCount: {
    type: Number,
    default: 0,
  },
  progressValue: {
    type: Number,
    default: 0,
    min: 0,
    max: 1,
  },
  lastWatchedAt: Date,
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
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  lecturesProgress: [LectureProgressSchema],
  quizzesProgress: [QuizProgressSchema],
});

// Helper method to check if all lectures are fully completed (100% watched)
CourseProgressSchema.methods.areAllLecturesCompleted = function () {
  return this.lecturesProgress.every(
    (lecture) => lecture.viewed && lecture.progressValue >= 1
  );
};

// Helper method to calculate overall progress percentage
CourseProgressSchema.methods.calculateProgressPercentage = function (
  totalLectures,
  totalQuizzes
) {
  let lectureProgress = 0;
  let quizProgress = 0;

  if (totalLectures > 0) {
    const completedLectures = this.lecturesProgress.filter(
      (lecture) => lecture.viewed && lecture.progressValue >= 1
    ).length;
    lectureProgress = (completedLectures / totalLectures) * 50; // 50% weight for lectures
  }

  if (totalQuizzes > 0) {
    const completedQuizzes = this.quizzesProgress.filter(
      (quiz) => quiz.completed
    ).length;
    quizProgress = (completedQuizzes / totalQuizzes) * 50; // 50% weight for quizzes
  }

  return Math.round(lectureProgress + quizProgress);
};

// Helper method to check if a specific lecture is completed
CourseProgressSchema.methods.isLectureCompleted = function (lectureId) {
  const lectureProgress = this.lecturesProgress.find(
    (lp) => lp.lectureId.toString() === lectureId.toString()
  );
  return (
    lectureProgress &&
    (lectureProgress.viewed || lectureProgress.progressValue >= 1)
  );
};

// Add indexes for frequently queried fields
CourseProgressSchema.index({ userId: 1 });
CourseProgressSchema.index({ courseId: 1 });
CourseProgressSchema.index({ completed: 1 });

module.exports = mongoose.model("Progress", CourseProgressSchema);
