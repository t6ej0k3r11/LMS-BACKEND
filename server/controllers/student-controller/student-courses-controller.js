const StudentCourses = require("../../models/StudentCourses");

const getCoursesByStudentId = async (req, res) => {
  try {
    const { studentId } = req.params;
    console.log(
      "🔍 DEBUG: getCoursesByStudentId called with studentId:",
      studentId,
      "type:",
      typeof studentId
    );

    const studentBoughtCourses = await StudentCourses.findOne({
      userId: studentId,
    });

    console.log(
      "🔍 DEBUG: StudentCourses.findOne result:",
      studentBoughtCourses ? "found" : "null"
    );

    if (!studentBoughtCourses) {
      console.log("🔍 DEBUG: No courses found for studentId:", studentId);
      return res.status(200).json({
        success: true,
        data: [],
      });
    }

    console.log(
      "🔍 DEBUG: Returning courses:",
      studentBoughtCourses.courses.length,
      "courses"
    );

    res.status(200).json({
      success: true,
      data: studentBoughtCourses.courses,
    });
  } catch (error) {
    console.error("🔍 DEBUG: Error in getCoursesByStudentId:", error);
    res.status(500).json({
      success: false,
      message: "Some error occured!",
    });
  }
};

module.exports = { getCoursesByStudentId };
