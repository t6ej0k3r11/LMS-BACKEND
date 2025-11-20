const express = require("express");
const router = express.Router();
const { verifyAdminToken } = require("../../middleware/admin-middleware");
const {
  getAllUsers,
  updateUser,
  deleteUser,
  deactivateUser,
  reactivateUser,
  bulkUserAction,
  getPendingCourses,
  reviewCourse,
  approveCourse,
  rejectCourse,
  getAuditLogs,
  getAdminStats,
  getRecentActivities,
  getAllCourses,
  updateCourseStatus,
  deleteCourse,
  getPendingInstructors,
  approveInstructor,
  rejectInstructor,
  createQuestion,
  getAllQuestions,
  updateQuestion,
  deleteQuestion,
} = require("../../controllers/admin-controller/index");

// Apply admin middleware to all routes
router.use(verifyAdminToken);

// User management routes
router.get("/users", getAllUsers);
router.put("/users/:userId", updateUser);
router.delete("/users/:userId", deleteUser);
router.patch("/users/:userId/deactivate", deactivateUser);
router.patch("/users/:userId/reactivate", reactivateUser);
router.post("/users/bulk-action", bulkUserAction);

// Course management routes
router.get("/courses", getAllCourses);
router.put("/courses/:courseId/status", updateCourseStatus);
router.delete("/courses/:courseId", deleteCourse);

// Course approval routes (legacy)
router.get("/courses/pending", getPendingCourses);
router.post("/courses/:courseId/review", reviewCourse);

// New course approval routes
router.patch("/courses/:id/approve", approveCourse);
router.patch("/courses/:id/reject", rejectCourse);

// Dashboard routes
router.get("/stats", getAdminStats);
router.get("/activities", getRecentActivities);

// Audit logs route
router.get("/audit-logs", getAuditLogs);

// Instructor management routes
router.get("/instructors/pending", getPendingInstructors);
router.patch("/instructors/:id/approve", approveInstructor);
router.patch("/instructors/:id/reject", rejectInstructor);

// Question Bank management routes
router.post("/questions", createQuestion);
router.get("/questions", getAllQuestions);
router.patch("/questions/:id", updateQuestion);
router.delete("/questions/:id", deleteQuestion);

module.exports = router;
