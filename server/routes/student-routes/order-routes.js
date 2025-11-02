const express = require("express");
const {
  createOrder,
  capturePaymentAndFinalizeOrder,
} = require("../../controllers/student-controller/order-controller");
const authenticate = require("../../middleware/auth-middleware");

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authenticate.authenticate);

router.post("/create", createOrder);
router.post("/capture", capturePaymentAndFinalizeOrder);

module.exports = router;
