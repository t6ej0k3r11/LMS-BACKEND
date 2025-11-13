const Course = require("../../models/Course");
const StudentCourses = require("../../models/StudentCourses");

const getAllStudentViewCourses = async (req, res) => {
  try {
    const {
      category = [],
      level = [],
      primaryLanguage = [],
      sortBy = "price-lowtohigh",
    } = req.query;

    let filters = {};
    if (category.length) {
      filters.category = { $in: category.split(",") };
    }
    if (level.length) {
      filters.level = { $in: level.split(",") };
    }
    if (primaryLanguage.length) {
      filters.primaryLanguage = { $in: primaryLanguage.split(",") };
    }

    let sortParam = {};
    switch (sortBy) {
      case "price-lowtohigh":
        sortParam.pricing = 1;

        break;
      case "price-hightolow":
        sortParam.pricing = -1;

        break;
      case "title-atoz":
        sortParam.title = 1;

        break;
      case "title-ztoa":
        sortParam.title = -1;

        break;

      default:
        sortParam.pricing = 1;
        break;
    }

    // Add pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Only show approved courses to students
    filters.approvalStatus = "approved";
    filters.isPublished = true;

    const coursesList = await Course.find(filters)
      .sort(sortParam)
      .skip(skip)
      .limit(limit);

    const totalCourses = await Course.countDocuments(filters);

    res.status(200).json({
      success: true,
      data: coursesList,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCourses / limit),
        totalCourses,
        hasNextPage: page * limit < totalCourses,
        hasPrevPage: page > 1,
      },
    });
  } catch (e) {
    console.error("Error getting student courses:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

const getStudentViewCourseDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const courseDetails = await Course.findById(id);

    if (!courseDetails) {
      return res.status(404).json({
        success: false,
        message: "No course details found",
        data: null,
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

const checkCoursePurchaseInfo = async (req, res) => {
  try {
    const { id, studentId } = req.params;
    const studentCourses = await StudentCourses.findOne({
      userId: studentId,
    });

    // If no student courses record exists, student hasn't bought any courses
    if (!studentCourses) {
      return res.status(200).json({
        success: true,
        data: { enrolled: false, completed: false },
      });
    }

    const courseIndex = studentCourses.courses.findIndex(
      (item) => item.courseId === id
    );
    const enrolled = courseIndex > -1;

    let completed = false;
    if (enrolled) {
      const CourseProgress = require("../../models/CourseProgress");
      const progress = await CourseProgress.findOne({
        userId: studentId,
        courseId: id,
      });
      completed = progress?.completed || false;
    }

    res.status(200).json({
      success: true,
      data: { enrolled, completed },
    });
  } catch (e) {
    console.error("Error checking course purchase info:", e);
    res.status(500).json({
      success: false,
      message: "Some error occurred!",
    });
  }
};

module.exports = {
  getAllStudentViewCourses,
  getStudentViewCourseDetails,
  checkCoursePurchaseInfo,
};
