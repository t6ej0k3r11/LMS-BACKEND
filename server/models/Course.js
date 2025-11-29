const mongoose = require("mongoose");

const LectureSchema = new mongoose.Schema({
  title: String,
  videoUrl: {
    type: String,
    validate: {
      validator: function (v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: "Video URL must be a valid URL",
    },
  },
  public_id: String,
  freePreview: Boolean,
});

const CourseSchema = new mongoose.Schema({
  instructorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  instructorName: String,
  date: Date,
  title: String,
  category: String,
  level: String,
  primaryLanguage: String,
  subtitle: String,
  description: String,
  image: {
    type: String,
    validate: {
      validator: function (v) {
        return /^https?:\/\/.+/.test(v);
      },
      message: "Image must be a valid URL",
    },
  },
  welcomeMessage: String,
  pricing: Number,
  courseType: String,
  objectives: String,
  students: [
    {
      studentId: String,
      studentName: String,
      studentEmail: {
        type: String,
        validate: {
          validator: function (v) {
            return /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
          },
          message: "Please enter a valid email address",
        },
      },
      paidAmount: String,
    },
  ],
  curriculum: [LectureSchema],
  lessons: [LectureSchema], // Alias for curriculum
  quizzes: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Quiz",
    },
  ],
  prerequisites: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
    },
  ],
  status: {
    type: String,
    enum: ["draft", "submitted", "published"],
    default: "draft",
  },
  approvalStatus: {
    type: String,
    enum: ["pending", "approved", "rejected"],
    default: "pending",
  },
  approvalDate: Date,
  publishedAt: Date,
  approvedBy: String, // admin ID who approved/rejected
  rejectionReason: String,
});

// Add indexes for frequently queried fields
CourseSchema.index({ instructorId: 1 });
CourseSchema.index({ category: 1 });
CourseSchema.index({ level: 1 });
CourseSchema.index({ status: 1 });

module.exports = mongoose.model("Course", CourseSchema);
