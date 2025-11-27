const Course = require("../../models/Course");
const CourseProgress = require("../../models/CourseProgress");
const Quiz = require("../../models/Quiz");
const QuizAttempt = require("../../models/QuizAttempt");
const StudentCourses = require("../../models/StudentCourses");
const Order = require("../../models/Order");
const User = require("../../models/User");

// Helper function to find course with ownership check
async function findInstructorCourse(courseId, userId) {
  return Course.findOne({ _id: courseId, instructorId: userId });
}

const addNewCourse = async (req, res) => {
  try {
    const courseData = req.body;

    // Basic validation
    const requiredFields = [
      "title",
      "category",
      "level",
      "primaryLanguage",
      "courseType",
      "subtitle",
      "description",
      "objectives",
      "welcomeMessage",
    ];
    const missingFields = [];

    for (const field of requiredFields) {
      if (!courseData[field] || courseData[field].toString().trim() === "") {
        missingFields.push(field);
      }
    }

    // Check pricing
    if (
      courseData.pricing === undefined ||
      courseData.pricing === null ||
      courseData.pricing === ""
    ) {
      missingFields.push("pricing");
    }

    // Check curriculum
    if (!courseData.curriculum || courseData.curriculum.length === 0) {
      missingFields.push("at least one lesson in curriculum");
    } else {
      let hasFreePreview = false;
      courseData.curriculum.forEach((item, index) => {
        if (!item.title || item.title.trim() === "") {
          missingFields.push(`Lesson ${index + 1} title`);
        }
        if (!item.videoUrl || item.videoUrl.trim() === "") {
          missingFields.push(`Lesson ${index + 1} video URL`);
        }
        if (!item.public_id || item.public_id.trim() === "") {
          missingFields.push(`Lesson ${index + 1} video file`);
        }
        if (item.freePreview) {
          hasFreePreview = true;
        }
      });

      if (!hasFreePreview) {
        missingFields.push("at least one free preview lesson");
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot create course. Missing or incomplete: ${missingFields.join(
          ", "
        )}`,
      });
    }

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
        message: "Course created successfully as draft",
        data: saveCourse,
      });
    }
  } catch (e) {
    console.error("Error adding course:", e);
    res.status(500).json({
      success: false,
      message: e.message || "Some error occurred!",
    });
  }
};

const getAllCourses = async (req, res) => {
  try {
    console.log("getAllCourses: Incoming request");
    console.log("getAllCourses: req.user =", req.user);
    console.log("getAllCourses: req.user._id =", req.user?._id);
    console.log("getAllCourses: req.user.role =", req.user?.role);

    let query = {};
    if (req.user.role !== "admin") {
      query.instructorId = req.user._id;
    }
    console.log("getAllCourses: Query =", query);

    const coursesList = await Course.find(query);
    console.log("getAllCourses: Found courses count =", coursesList.length);
    console.log(
      "getAllCourses: Courses =",
      coursesList.map((c) => ({
        id: c._id,
        title: c.title,
        instructorId: c.instructorId,
      }))
    );

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
    const requiredFields = [
      "title",
      "category",
      "level",
      "primaryLanguage",
      "courseType",
      "subtitle",
      "description",
      "objectives",
      "welcomeMessage",
    ];
    const missingFields = [];

    for (const field of requiredFields) {
      if (!course[field] || course[field].toString().trim() === "") {
        missingFields.push(field);
      }
    }

    // Check pricing (must be a valid number)
    if (
      course.pricing === undefined ||
      course.pricing === null ||
      course.pricing === ""
    ) {
      missingFields.push("pricing");
    }

    // Check if curriculum has at least one lesson
    if (!course.curriculum || course.curriculum.length === 0) {
      missingFields.push("at least one lesson in curriculum");
    } else {
      // Check curriculum items have required fields
      let hasFreePreview = false;
      course.curriculum.forEach((item, index) => {
        if (!item.title || item.title.trim() === "") {
          missingFields.push(`Lesson ${index + 1} title`);
        }
        if (!item.videoUrl || item.videoUrl.trim() === "") {
          missingFields.push(`Lesson ${index + 1} video URL`);
        }
        if (!item.public_id || item.public_id.trim() === "") {
          missingFields.push(`Lesson ${index + 1} video file`);
        }
        if (item.freePreview) {
          hasFreePreview = true;
        }
      });

      if (!hasFreePreview) {
        missingFields.push("at least one free preview lesson");
      }
    }

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot publish course. Missing or incomplete: ${missingFields.join(
          ", "
        )}`,
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

const getEnrolledStudents = async (req, res) => {
  try {
    const instructorId = req.user._id;

    // Get all course IDs created by this instructor
    const instructorCourses = await Course.find({ instructorId }, "_id title");
    const courseIds = instructorCourses.map((course) => course._id.toString());

    if (courseIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    // Find all StudentCourses where courses contain any of the instructor's courseIds
    const enrolledStudentCourses = await StudentCourses.find({
      "courses.courseId": { $in: courseIds },
    }).populate("userId", "userName userEmail"); // Assuming userId is ObjectId ref to User

    // Wait, StudentCourses.userId is string, not ObjectId. Need to adjust.

    // Since userId is string, can't populate. Need to fetch users separately.

    // Get unique userIds from enrolled students
    const userIds = [...new Set(enrolledStudentCourses.map((sc) => sc.userId))];

    // Fetch user details
    const users = await User.find(
      { _id: { $in: userIds } },
      "userName userEmail"
    );

    // Create a map for quick lookup
    const userMap = users.reduce((map, user) => {
      map[user._id.toString()] = { name: user.userName, email: user.userEmail };
      return map;
    }, {});

    // Build the response data
    const enrolledStudents = enrolledStudentCourses
      .map((sc) => {
        const userInfo = userMap[sc.userId];
        if (!userInfo) return null;

        const enrolledCourses = sc.courses
          .filter((course) => courseIds.includes(course.courseId))
          .map((course) => ({
            courseId: course.courseId,
            title: course.title,
            dateOfPurchase: course.dateOfPurchase,
          }));

        return {
          id: sc.userId,
          name: userInfo.name,
          email: userInfo.email,
          enrolledCourses,
        };
      })
      .filter(Boolean);

    res.status(200).json({
      success: true,
      data: enrolledStudents,
    });
  } catch (e) {
    console.error("Error getting enrolled students:", e);
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

const getCoursePrerequisites = async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId).populate(
      "prerequisites",
      "title _id"
    );
    if (!course) {
      return res.status(404).json({
        success: false,
        message: "Course not found",
      });
    }

    res.status(200).json({
      success: true,
      data: course.prerequisites,
    });
  } catch (e) {
    console.error("Error getting course prerequisites:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

module.exports = {
  addNewCourse,
  getAllCourses,
  updateCourseByID,
  getCourseDetailsByID,
  publishCourse,
  getEnrolledStudents,
  deleteCourseByID,
  getCoursePrerequisites,
};
