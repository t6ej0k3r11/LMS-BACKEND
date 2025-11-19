const express = require("express");
const {
  addNewCourse,
  getAllCourses,
  getCourseDetailsByID,
  updateCourseByID,
  publishCourse,
  deleteCourseByID,
} = require("../../controllers/instructor-controller/course-controller");
const authenticate = require("../../middleware/auth-middleware");
const {
  checkInstructorRole,
  checkInstructorApproved,
} = require("../../middleware/instructor-middleware");
const {
  validateCourseCreation,
} = require("../../middleware/validation-middleware");
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate.authenticate);

// Course creation and management (allow any instructor)
router.post("/add", checkInstructorRole, validateCourseCreation, addNewCourse);
router.post(
  "/draft",
  checkInstructorRole,
  validateCourseCreation,
  addNewCourse
); // Alias for creating draft
router.get("/get", checkInstructorRole, getAllCourses);
router.get("/get/details/:id", checkInstructorRole, getCourseDetailsByID);
router.put(
  "/update/:id",
  checkInstructorRole,
  validateCourseCreation,
  updateCourseByID
);
router.delete("/delete/:id", checkInstructorRole, deleteCourseByID);

// Publishing requires instructor role (course approval checked in controller)
router.patch("/:id/publish", checkInstructorRole, publishCourse);

module.exports = router;
