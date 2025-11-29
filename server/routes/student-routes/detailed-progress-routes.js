const express = require("express");
const router = express.Router();
const {
  updateLectureProgress,
  getCourseProgress,
  getCertificateProgress,
  updateQuizProgress,
  mergeLocalProgress,
} = require("../../controllers/student-controller/detailed-progress-controller");
const { authenticate } = require("../../middleware/auth-middleware");

// All routes require authentication
router.use(authenticate);

// 1. Update Lecture Progress (Auto-save video progress)
router.post("/update", updateLectureProgress);

// 2. Get Course Progress (Complete progress overview)
router.get("/course/:courseId", getCourseProgress);

// 3. Get Certificate Progress
router.get("/certificate/:courseId", getCertificateProgress);

// 4. Update Quiz Progress
router.post("/quiz/update", updateQuizProgress);

// 5. Merge LocalStorage Progress
router.post("/merge", mergeLocalProgress);

module.exports = router;