const express = require("express");
const multer = require("multer");
const path = require("path");
const {
  initOnlinePayment,
  handlePaymentSuccess,
  handlePaymentFail,
  handlePaymentCancel,
  submitOfflinePayment,
  listPendingOfflinePayments,
  verifyOfflinePayment,
  rejectOfflinePayment,
  getAllPayments,
  getPaymentById,
  updatePaymentStatus,
  getMyPayments,
  getPaymentDetails,
} = require("../../controllers/payment-controller/index");
const authenticateMiddleware = require("../../middleware/auth-middleware");
const { verifyAdminToken } = require("../../middleware/admin-middleware");
const { paymentInitRateLimit } = require("../../middleware/payment-middleware");
const {
  validateOnlinePaymentInit,
  validateOfflinePaymentSubmit,
  validatePaymentStatusUpdate,
  validateAdminNote,
} = require("../../middleware/validation-middleware");
const { createFileFilter, createLimits } = require("../../middleware/fileValidation");
const PAYMENT_CONFIG = require("../../config/paymentConfig");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, PAYMENT_CONFIG.FILE_UPLOAD.UPLOAD_PATH);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "file_" + uniqueSuffix + "_" + file.originalname);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: createFileFilter(['image', 'document']),
  limits: createLimits(['image', 'document'])
});

const router = express.Router();

// =========================
// Online Payment Routes
// =========================
router.post(
  "/online/init",
  authenticateMiddleware.authenticate,
  paymentInitRateLimit,
  validateOnlinePaymentInit,
  initOnlinePayment
);

router.get("/online/success", handlePaymentSuccess);
router.get("/online/fail", handlePaymentFail);
router.get("/online/cancel", handlePaymentCancel);

// =========================
// Offline Payment Routes
// =========================
router.post(
  "/offline/submit",
  authenticateMiddleware.authenticate,
  upload.single(PAYMENT_CONFIG.FIELDS.PROOF_FILE),
  validateOfflinePaymentSubmit,
  submitOfflinePayment
);

router.get(
  "/offline/list",
  authenticateMiddleware.authenticate,
  verifyAdminToken,
  listPendingOfflinePayments
);

router.patch(
  "/offline/verify/:id",
  authenticateMiddleware.authenticate,
  verifyAdminToken,
  verifyOfflinePayment
);

router.patch(
  "/offline/reject/:id",
  authenticateMiddleware.authenticate,
  verifyAdminToken,
  validateAdminNote,
  rejectOfflinePayment
);

// =========================
// Admin Payment Management Routes
// =========================
router.get(
  "/admin",
  authenticateMiddleware.authenticate,
  verifyAdminToken,
  getAllPayments
);

router.get(
  "/admin/:id",
  authenticateMiddleware.authenticate,
  verifyAdminToken,
  getPaymentById
);

router.put(
  "/admin/update-status/:id",
  authenticateMiddleware.authenticate,
  verifyAdminToken,
  validatePaymentStatusUpdate,
  updatePaymentStatus
);

// =========================
// Student Payment History Routes
// =========================
router.get(
  "/my-payments",
  authenticateMiddleware.authenticate,
  getMyPayments
);

router.get(
  "/details/:id",
  authenticateMiddleware.authenticate,
  getPaymentDetails
);

module.exports = router;