const express = require("express");
const {
  addNewCourse,
  getAllCourses,
  getCourseDetailsByID,
  updateCourseByID,
  deleteCourseByID,
} = require("../../controllers/instructor-controller/course-controller");
const authenticate = require("../../middleware/auth-middleware");
const {
  validateCourseCreation,
} = require("../../middleware/validation-middleware");
const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate.authenticate);

router.post("/add", validateCourseCreation, addNewCourse);
router.get("/get", getAllCourses);
router.get("/get/details/:id", getCourseDetailsByID);
router.put("/update/:id", validateCourseCreation, updateCourseByID);
router.delete("/delete/:id", deleteCourseByID);

module.exports = router;
