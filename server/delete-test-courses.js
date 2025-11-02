require("dotenv").config();
const mongoose = require("mongoose");

// Import models
const Course = require("./models/Course");
const CourseProgress = require("./models/CourseProgress");
const StudentCourses = require("./models/StudentCourses");
const Order = require("./models/Order");
const Quiz = require("./models/Quiz");
const QuizAttempt = require("./models/QuizAttempt");

const MONGO_URI = process.env.MONGO_URI;

async function deleteTestCourses() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    console.log("✅ MongoDB connected successfully");

    // Define regex pattern for dummy/test courses (case-insensitive)
    const dummyRegex = /test|dummy|sample|example|demo/i;

    // Find dummy courses
    const dummyCourses = await Course.find({ title: { $regex: dummyRegex } });
    console.log(`Found ${dummyCourses.length} dummy/test courses`);

    if (dummyCourses.length === 0) {
      console.log("No dummy/test courses found. Exiting.");
      return;
    }

    // Extract course IDs
    const courseIds = dummyCourses.map((course) => course._id);
    const courseIdStrings = courseIds.map((id) => id.toString());

    // Delete courses
    const deletedCourses = await Course.deleteMany({ _id: { $in: courseIds } });
    console.log(`Deleted ${deletedCourses.deletedCount} courses`);

    // Delete course progress records
    const deletedProgress = await CourseProgress.deleteMany({
      courseId: { $in: courseIds },
    });
    console.log(
      `Deleted ${deletedProgress.deletedCount} course progress records`
    );

    // Delete quizzes
    const deletedQuizzes = await Quiz.deleteMany({
      courseId: { $in: courseIds },
    });
    console.log(`Deleted ${deletedQuizzes.deletedCount} quizzes`);

    // Delete quiz attempts
    const deletedAttempts = await QuizAttempt.deleteMany({
      courseId: { $in: courseIds },
    });
    console.log(`Deleted ${deletedAttempts.deletedCount} quiz attempts`);

    // Delete orders
    const deletedOrders = await Order.deleteMany({
      courseId: { $in: courseIdStrings },
    });
    console.log(`Deleted ${deletedOrders.deletedCount} orders`);

    // Update student courses (remove deleted courses from courses array)
    const studentCourses = await StudentCourses.find({
      "courses.courseId": { $in: courseIdStrings },
    });
    let updatedStudentCourses = 0;

    for (const studentCourse of studentCourses) {
      const originalLength = studentCourse.courses.length;
      studentCourse.courses = studentCourse.courses.filter(
        (course) => !courseIdStrings.includes(course.courseId)
      );
      if (studentCourse.courses.length !== originalLength) {
        await studentCourse.save();
        updatedStudentCourses++;
      }
    }

    console.log(`Updated ${updatedStudentCourses} student courses records`);

    console.log("✅ Dummy/test course deletion completed successfully");
  } catch (error) {
    console.error("❌ Error deleting dummy/test courses:", error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log("✅ MongoDB disconnected");
  }
}

// Run the script
deleteTestCourses();
