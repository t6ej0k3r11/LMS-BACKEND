const Course = require("../../models/Course");
const CourseProgress = require("../../models/CourseProgress");
const Quiz = require("../../models/Quiz");
const QuizAttempt = require("../../models/QuizAttempt");
const StudentCourses = require("../../models/StudentCourses");
const Order = require("../../models/Order");

// Helper function to find course with ownership check
async function findInstructorCourse(courseId, userId) {
  return Course.findOne({ _id: courseId, instructorId: userId });
}

const addNewCourse = async (req, res) => {
  try {
    const courseData = req.body;

    // Set default values
    courseData.pricing = courseData.pricing || 0;
    courseData.approvalStatus = "pending";
    courseData.status = "draft";
    courseData.instructorId = req.user._id; // Ensure ownership

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
    let query = {};
    if (req.user.role !== "admin") {
      query.instructorId = req.user._id;
    }
    const coursesList = await Course.find(query);

    res.status(200).json({
      success: true,
      data: coursesList,
    });
  } catch (e) {
    console.error("Error getting courses:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

const getCourseDetailsByID = async (req, res) => {
  try {
    const { id } = req.params;
    let courseDetails;
    if (req.user.role === "admin") {
      courseDetails = await Course.findById(id);
    } else {
      courseDetails = await findInstructorCourse(id, req.user._id);
      if (!courseDetails) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to modify this course",
        });
      }
    }

    if (!courseDetails) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    // Additional ownership check
    if (
      req.user.role !== "admin" &&
      courseDetails.instructorId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not your course",
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

    let course;
    if (req.user.role === "admin") {
      course = await Course.findById(id);
    } else {
      course = await findInstructorCourse(id, req.user._id);
      if (!course) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to modify this course",
        });
      }
    }

    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    // Additional ownership check
    if (
      req.user.role !== "admin" &&
      course.instructorId.toString() !== req.user._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not your course",
      });
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      id,
      updatedCourseData,
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Course updated successfully",
      data: updatedCourse,
    });
  } catch (e) {
    console.error("Error updating course:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

const publishCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user._id;

    // Find the course and verify ownership
    let course;
    if (req.user.role === "admin") {
      course = await Course.findById(id);
    } else {
      course = await findInstructorCourse(id, req.user._id);
      if (!course) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to modify this course",
        });
      }
    }
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    // Check if the instructor owns this course (skip for admin)
    if (
      req.user.role !== "admin" &&
      course.instructorId.toString() !== instructorId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not your course",
      });
    }

    // Check if course is already submitted or published
    if (course.status === "submitted" || course.status === "published") {
      return res.status(400).json({
        success: false,
        message: "Course is already submitted for review or published!",
      });
    }

    // Check required fields
    const requiredFields = ["title", "description"];
    const missingFields = requiredFields.filter(
      (field) => !course[field] || course[field].trim() === ""
    );

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(", ")}`,
      });
    }

    // Check if curriculum has at least one lesson
    if (!course.curriculum || course.curriculum.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Course must have at least one lesson before publishing!",
      });
    }

    // Submit the course for review
    course.status = "submitted";
    course.approvalStatus = "pending";
    await course.save();

    res.status(200).json({
      success: true,
      message: "Course submitted for review successfully!",
      data: course,
    });
  } catch (e) {
    console.error("Error publishing course:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred while publishing the course!",
    });
  }
};

const deleteCourseByID = async (req, res) => {
  try {
    const { id } = req.params;
    const instructorId = req.user._id;

    // Find the course and verify ownership
    let course;
    if (req.user.role === "admin") {
      course = await Course.findById(id);
    } else {
      course = await findInstructorCourse(id, req.user._id);
      if (!course) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to modify this course",
        });
      }
    }
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found!",
      });
    }

    // Check if the instructor owns this course (skip for admin)
    if (
      req.user.role !== "admin" &&
      course.instructorId.toString() !== instructorId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not your course",
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
  publishCourse,
  deleteCourseByID,
};
