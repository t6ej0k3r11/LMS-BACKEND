const Course = require("../../models/Course");
const CourseProgress = require("../../models/CourseProgress");
const Quiz = require("../../models/Quiz");
const QuizAttempt = require("../../models/QuizAttempt");
const StudentCourses = require("../../models/StudentCourses");
const Order = require("../../models/Order");

const addNewCourse = async (req, res) => {
  try {
    const courseData = req.body;

    // Set default approval status to pending for new courses
    courseData.approvalStatus = "pending";

    const newlyCreatedCourse = new Course(courseData);
    const saveCourse = await newlyCreatedCourse.save();

    if (saveCourse) {
      res.status(201).json({
        success: true,
        message: "Course submitted successfully and is pending admin approval",
        data: saveCourse,
      });
    }
  } catch (e) {
    console.error("Error adding course:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

const getAllCourses = async (req, res) => {
  try {
    const coursesList = await Course.find({});

    res.status(200).json({
      success: true,
      data: coursesList,
    });
  } catch (e) {
    console.error("Error updating course:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

const getCourseDetailsByID = async (req, res) => {
  try {
    const { id } = req.params;
    const courseDetails = await Course.findById(id);

    if (!courseDetails) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    res.status(200).json({
      success: true,
      data: courseDetails,
    });
  } catch (e) {
    console.error("Error getting course details:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

const updateCourseByID = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedCourseData = req.body;

    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      updatedCourseData,
      { new: true }
    );

    if (!updatedCourse) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: updatedCourse,
    });
  } catch (e) {
    console.error("Error getting courses:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

const deleteCourseByID = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user._id;

    // Find the course and verify ownership
    const course = await Course.findById(id);
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    // Check if the instructor owns this course
    if (course.instructorId !== instructorId) {
      return res.status(403).json({
        success: false,
        message: "You don't have permission to delete this course!",
      });
    }

    // Delete related data in sequence
    // 1. Delete all quiz attempts for this course's quizzes
    const quizzes = await Quiz.find({ courseId: id });
    const quizIds = quizzes.map((quiz) => quiz._id);
    await QuizAttempt.deleteMany({ courseId: id });

    // 2. Delete all quizzes for this course
    await Quiz.deleteMany({ courseId: id });

    // 3. Delete all course progress records
    await CourseProgress.deleteMany({ courseId: id });

    // 4. Remove course from all student courses lists
    await StudentCourses.updateMany(
      {},
      { $pull: { courses: { courseId: id } } }
    );

    // 5. Delete all orders related to this course
    await Order.deleteMany({ courseId: id });

    // 6. Finally, delete the course itself
    await Course.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: "Course and all related data deleted successfully",
    });
  } catch (e) {
    console.error("Error deleting course:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred while deleting the course!",
    });
  }
};

module.exports = {
  addNewCourse,
  getAllCourses,
  updateCourseByID,
  getCourseDetailsByID,
  deleteCourseByID,
};
