const express = require("express");
const {
  applyForInstructor,
} = require("../../controllers/instructor-controller/apply-controller");

const router = express.Router();

// Instructor application route
router.post("/apply", applyForInstructor);

module.exports = router;
