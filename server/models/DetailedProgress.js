const mongoose = require("mongoose");

const DetailedLectureProgressSchema = new mongoose.Schema({
  lectureId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Lecture",
    required: true,
  },
  progressPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  lastTimestamp: {
    type: Number,
    default: 0, // in seconds
  },
  duration: {
    type: Number,
    default: 0, // in seconds
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
  },
  isRewatch: {
    type: Boolean,
    default: false,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const DetailedQuizProgressSchema = new mongoose.Schema({
  quizId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Quiz",
    required: true,
  },
  score: {
    type: Number,
    default: 0,
  },
  passed: {
    type: Boolean,
    default: false,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedAt: {
    type: Date,
  },
  attempts: {
    type: Number,
    default: 0,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

const DetailedCourseProgressSchema = new mongoose.Schema({
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
  lectures: [DetailedLectureProgressSchema],
  quizzes: [DetailedQuizProgressSchema],
  
  // Calculated fields
  overallProgressPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  videoProgressPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  quizProgressPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  completedLecturesCount: {
    type: Number,
    default: 0,
  },
  totalLecturesCount: {
    type: Number,
    default: 0,
  },
  completedQuizzesCount: {
    type: Number,
    default: 0,
  },
  totalQuizzesCount: {
    type: Number,
    default: 0,
  },
  
  // Course completion
  isCompleted: {
    type: Boolean,
    default: false,
  },
  completionDate: {
    type: Date,
  },
  
  // Certificate eligibility (90% threshold)
  certificateEligible: {
    type: Boolean,
    default: false,
  },
  certificateProgressPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  
  // Metadata
  lastAccessedAt: {
    type: Date,
    default: Date.now,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for performance
DetailedCourseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });
DetailedCourseProgressSchema.index({ userId: 1 });
DetailedCourseProgressSchema.index({ courseId: 1 });
DetailedCourseProgressSchema.index({ isCompleted: 1 });
DetailedCourseProgressSchema.index({ certificateEligible: 1 });

// Pre-save middleware to update timestamps
DetailedCourseProgressSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to calculate course progress
DetailedCourseProgressSchema.statics.calculateProgress = function(progressData, courseData) {
  const { lectures, quizzes } = progressData;
  const { totalLectures = 0, totalQuizzes = 0 } = courseData;
  
  // Calculate lecture progress
  const lectureProgress = lectures.reduce((sum, lecture) => sum + lecture.progressPercent, 0);
  const completedLectures = lectures.filter(l => l.completed).length;
  
  // Calculate quiz progress
  const quizProgress = quizzes.reduce((sum, quiz) => sum + (quiz.completed ? 100 : 0), 0);
  const completedQuizzes = quizzes.filter(q => q.completed).length;
  
  // Overall progress
  const overallProgress = totalLectures > 0 || totalQuizzes > 0 ? 
    Math.round(((lectureProgress + quizProgress) / (totalLectures + totalQuizzes)) || 0) : 0;
  
  // Video progress (lectures only)
  const videoProgress = totalLectures > 0 ? Math.round(lectureProgress / totalLectures) : 0;
  
  // Quiz progress
  const quizProgressPercent = totalQuizzes > 0 ? Math.round(quizProgress / totalQuizzes) : 0;
  
  // Certificate eligibility (90% threshold)
  const certificateProgress = totalLectures > 0 ? 
    Math.round((completedLectures / totalLectures) * 100) : 0;
  
  return {
    overallProgressPercent: Math.min(overallProgress, 100),
    videoProgressPercent: Math.min(videoProgress, 100),
    quizProgressPercent: Math.min(quizProgressPercent, 100),
    completedLecturesCount: completedLectures,
    totalLecturesCount: totalLectures,
    completedQuizzesCount: completedQuizzes,
    totalQuizzesCount: totalQuizzes,
    certificateEligible: certificateProgress >= 90,
    certificateProgressPercent: certificateProgress,
    isCompleted: overallProgress === 100,
  };
};

// Instance method to find or update lecture progress
DetailedCourseProgressSchema.methods.updateLectureProgress = function(lectureId, progressData) {
  const { progressPercent, lastTimestamp, duration, isRewatch = false } = progressData;
  
  // Find existing lecture progress or create new
  let lectureProgress = this.lectures.find(l => l.lectureId.toString() === lectureId.toString());
  
  if (!lectureProgress) {
    lectureProgress = {
      lectureId,
      progressPercent: 0,
      lastTimestamp: 0,
      duration: 0,
      completed: false,
    };
    this.lectures.push(lectureProgress);
  }
  
  // Update progress
  lectureProgress.progressPercent = Math.min(Math.max(progressPercent, 0), 100);
  lectureProgress.lastTimestamp = Math.max(lastTimestamp, lectureProgress.lastTimestamp);
  lectureProgress.duration = Math.max(duration, lectureProgress.duration);
  lectureProgress.isRewatch = isRewatch;
  lectureProgress.updatedAt = new Date();
  
  // Mark as completed if 90% or more watched
  if (!lectureProgress.completed && progressPercent >= 90) {
    lectureProgress.completed = true;
    lectureProgress.completedAt = new Date();
  }
  
  this.lastAccessedAt = new Date();
  return lectureProgress;
};

// Instance method to update quiz progress
DetailedCourseProgressSchema.methods.updateQuizProgress = function(quizId, progressData) {
  const { score, passed, completed } = progressData;
  
  // Find existing quiz progress or create new
  let quizProgress = this.quizzes.find(q => q.quizId.toString() === quizId.toString());
  
  if (!quizProgress) {
    quizProgress = {
      quizId,
      score: 0,
      passed: false,
      completed: false,
      attempts: 0,
    };
    this.quizzes.push(quizProgress);
  }
  
  // Update progress
  quizProgress.score = Math.max(score, quizProgress.score);
  quizProgress.passed = passed;
  quizProgress.completed = completed || passed;
  quizProgress.attempts += 1;
  quizProgress.updatedAt = new Date();
  
  if (quizProgress.completed && !quizProgress.completedAt) {
    quizProgress.completedAt = new Date();
  }
  
  this.lastAccessedAt = new Date();
  return quizProgress;
};

module.exports = mongoose.model("DetailedCourseProgress", DetailedCourseProgressSchema);