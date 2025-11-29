const mongoose = require("mongoose");

const StudentCoursesSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  courses: [
    {
      courseId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Course",
        required: true,
      },
      title: String,
      instructorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      instructorName: String,
      dateOfPurchase: Date,
      courseImage: String,
    },
  ],
});

module.exports = mongoose.model("StudentCourses", StudentCoursesSchema);
