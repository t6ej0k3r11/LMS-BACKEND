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
  getAuditLogs,
  getAdminStats,
  getRecentActivities,
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

// Course approval routes
router.get("/courses/pending", getPendingCourses);
router.post("/courses/:courseId/review", reviewCourse);

// Dashboard routes
router.get("/stats", getAdminStats);
router.get("/activities", getRecentActivities);

// Audit logs route
router.get("/audit-logs", getAuditLogs);

module.exports = router;
