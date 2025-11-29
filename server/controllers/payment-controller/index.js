const Payment = require("../../models/Payment");
const User = require("../../models/User");
const Course = require("../../models/Course");
const StudentCourses = require("../../models/StudentCourses");
const crypto = require("crypto");
const { initiateSSLCommerzPayment } = require("../../utils/sslcommerz");
const { initiateAamarPayPayment } = require("../../utils/aamarpay");
const multer = require("multer");
const path = require("path");
const PAYMENT_CONFIG = require("../../config/paymentConfig");
const { createFileFilter, createLimits } = require("../../middleware/fileValidation");

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

// Generate unique transaction ID
const generateTransactionId = () => {
  return "TXN_" + crypto.randomBytes(8).toString("hex").toUpperCase();
};

// Helper function to enroll student in course
const enrollStudentInCourse = async (userId, courseId) => {
  try {
    const course = await Course.findById(courseId);
    if (!course) {
      throw new Error("Course not found");
    }

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if already enrolled
    const existingEnrollment = course.students.find(
      (student) => student.studentId === userId.toString()
    );

    if (!existingEnrollment) {
      // Add to course students
      course.students.push({
        studentId: userId.toString(),
        studentName: user.userName,
        studentEmail: user.userEmail,
        paidAmount: course.pricing.toString(),
      });
      await course.save();

      // Add to student courses
      let studentCourses = await StudentCourses.findOne({ userId: userId.toString() });
      if (!studentCourses) {
        studentCourses = new StudentCourses({ userId: userId.toString(), courses: [] });
      }

      const courseExists = studentCourses.courses.find(
        (c) => c.courseId === courseId.toString()
      );

      if (!courseExists) {
        studentCourses.courses.push({
          courseId: courseId.toString(),
          title: course.title,
          instructorId: course.instructorId,
          instructorName: course.instructorName,
          dateOfPurchase: new Date(),
          courseImage: course.image,
        });
        await studentCourses.save();
      }
    }

    return { success: true };
  } catch (error) {
    console.error("Enrollment error:", error);
    return { success: false, error: error.message };
  }
};

// =========================
// Online Payment APIs
// =========================

// Initialize online payment
const initOnlinePayment = async (req, res) => {
  const { courseId, method } = req.body;
  const userId = req.user._id;

  if (!courseId || !method) {
    return res.status(400).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Course ID and payment method are required",
    });
  }

  const validMethods = [PAYMENT_CONFIG.METHODS.SSLCOMMERZ, PAYMENT_CONFIG.METHODS.AAMARPAY];
  if (!validMethods.includes(method)) {
    return res.status(400).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Invalid payment method. Must be sslcommerz or aamarpay",
    });
  }

  try {
    // Check if course exists and is published
    const course = await Course.findById(courseId);
    if (!course || course.status !== "published" || course.approvalStatus !== "approved") {
      return res.status(404).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Course not found or not available for purchase",
      });
    }

    // Check if user already has a pending payment for this course
    const existingPayment = await Payment.findOne({
      userId,
      courseId,
      [PAYMENT_CONFIG.FIELDS.STATUS]: { $in: [PAYMENT_CONFIG.STATUSES.PENDING, PAYMENT_CONFIG.STATUSES.PROCESSING] },
    });

    if (existingPayment) {
      return res.status(400).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "You already have a pending payment for this course",
      });
    }

    // Check if already enrolled
    const isEnrolled = course.students.some(
      (student) => student.studentId === userId.toString()
    );

    if (isEnrolled) {
      // Check if also in StudentCourses, if not, add it to sync
      const studentCourses = await StudentCourses.findOne({ userId: userId.toString() });
      const courseExistsInStudentCourses = studentCourses?.courses?.some(
        (c) => c.courseId === courseId.toString()
      );

      if (!courseExistsInStudentCourses) {
        // Sync: add to StudentCourses
        if (!studentCourses) {
          const newStudentCourses = new StudentCourses({
            userId: userId.toString(),
            courses: [{
              courseId: courseId.toString(),
              title: course.title,
              instructorId: course.instructorId,
              instructorName: course.instructorName,
              dateOfPurchase: new Date(),
              courseImage: course.image,
            }]
          });
          await newStudentCourses.save();
        } else {
          studentCourses.courses.push({
            courseId: courseId.toString(),
            title: course.title,
            instructorId: course.instructorId,
            instructorName: course.instructorName,
            dateOfPurchase: new Date(),
            courseImage: course.image,
          });
          await studentCourses.save();
        }
        console.log("Synced enrollment: added course to StudentCourses");
      }

      return res.status(400).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "You are already enrolled in this course",
      });
    }

    const transactionId = generateTransactionId();

    // Create payment record
    const payment = new Payment({
      userId,
      courseId,
      [PAYMENT_CONFIG.FIELDS.AMOUNT]: course.pricing,
      currency: "BDT",
      [PAYMENT_CONFIG.FIELDS.METHOD]: method,
      [PAYMENT_CONFIG.FIELDS.TRANSACTION_ID]: transactionId,
      [PAYMENT_CONFIG.FIELDS.STATUS]: PAYMENT_CONFIG.STATUSES.PENDING,
    });

    await payment.save();

    // Initialize payment with gateway
    let paymentData;
    if (method === PAYMENT_CONFIG.METHODS.SSLCOMMERZ) {
      paymentData = await initiateSSLCommerzPayment({
        transactionId,
        amount: course.pricing,
        currency: "BDT",
        customerName: req.user.userName,
        customerEmail: req.user.userEmail,
        courseTitle: course.title,
        successUrl: `${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.SUCCESS}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}`,
        failUrl: `${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.FAIL}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}`,
        cancelUrl: `${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.CANCEL}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}`,
      });
    } else if (method === PAYMENT_CONFIG.METHODS.AAMARPAY) {
      paymentData = await initiateAamarPayPayment({
        transactionId,
        amount: course.pricing,
        currency: "BDT",
        customerName: req.user.userName,
        customerEmail: req.user.userEmail,
        courseTitle: course.title,
        successUrl: `${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.SUCCESS}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}`,
        failUrl: `${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.FAIL}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}`,
        cancelUrl: `${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.CANCEL}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}`,
      });
    }

    res.status(200).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: true,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment initialized successfully",
      [PAYMENT_CONFIG.RESPONSE_FORMAT.DATA]: {
        [PAYMENT_CONFIG.FIELDS.TRANSACTION_ID]: transactionId,
        paymentUrl: paymentData.paymentUrl,
        gatewayData: paymentData,
      },
    });
  } catch (error) {
    console.error("Payment initialization error:", error);
    res.status(500).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Failed to initialize payment",
    });
  }
};

// Handle payment success callback
const handlePaymentSuccess = async (req, res) => {
  const { [PAYMENT_CONFIG.FIELDS.TRANSACTION_ID]: transactionId, ...gatewayData } = req.query;

  try {
    const payment = await Payment.findOne({ [PAYMENT_CONFIG.FIELDS.TRANSACTION_ID]: transactionId });
    if (!payment) {
      return res.redirect(`${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.FAIL}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}&error=Payment not found`);
    }

    if (payment[PAYMENT_CONFIG.FIELDS.STATUS] === PAYMENT_CONFIG.STATUSES.VERIFIED) {
      return res.redirect(`${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.SUCCESS}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}&${PAYMENT_CONFIG.FIELDS.AMOUNT}=${payment[PAYMENT_CONFIG.FIELDS.AMOUNT]}`);
    }

    // Update payment status
    payment[PAYMENT_CONFIG.FIELDS.STATUS] = PAYMENT_CONFIG.STATUSES.VERIFIED;
    await payment.save();

    // Enroll student
    const enrollmentResult = await enrollStudentInCourse(payment.userId, payment.courseId);
    if (!enrollmentResult.success) {
      console.error("Enrollment failed:", enrollmentResult.error);
      // Still mark as verified but log the error
    }

    // Redirect to success page with transaction ID and amount
    res.redirect(`${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.SUCCESS}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}&${PAYMENT_CONFIG.FIELDS.AMOUNT}=${payment[PAYMENT_CONFIG.FIELDS.AMOUNT]}`);
  } catch (error) {
    console.error("Payment success handling error:", error);
    res.redirect(`${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.FAIL}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}&error=Processing failed`);
  }
};

// Handle payment failure callback
const handlePaymentFail = async (req, res) => {
  const { [PAYMENT_CONFIG.FIELDS.TRANSACTION_ID]: transactionId } = req.query;

  try {
    const payment = await Payment.findOne({ [PAYMENT_CONFIG.FIELDS.TRANSACTION_ID]: transactionId });
    if (payment) {
      payment[PAYMENT_CONFIG.FIELDS.STATUS] = PAYMENT_CONFIG.STATUSES.FAILED;
      await payment.save();
    }

    res.redirect(`${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.FAIL}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}`);
  } catch (error) {
    console.error("Payment fail handling error:", error);
    res.redirect(`${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.FAIL}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}&error=Processing failed`);
  }
};

// Handle payment cancellation callback
const handlePaymentCancel = async (req, res) => {
  const { [PAYMENT_CONFIG.FIELDS.TRANSACTION_ID]: transactionId } = req.query;

  try {
    const payment = await Payment.findOne({ [PAYMENT_CONFIG.FIELDS.TRANSACTION_ID]: transactionId });
    if (payment) {
      payment[PAYMENT_CONFIG.FIELDS.STATUS] = PAYMENT_CONFIG.STATUSES.CANCELLED;
      await payment.save();
    }

    res.redirect(`${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.CANCEL}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}`);
  } catch (error) {
    console.error("Payment cancel handling error:", error);
    res.redirect(`${PAYMENT_CONFIG.CLIENT_BASE_URL}${PAYMENT_CONFIG.ROUTES.CANCEL}?${PAYMENT_CONFIG.FIELDS.TRANSACTION_ID}=${transactionId}&error=Processing failed`);
  }
};

// =========================
// Offline Payment APIs
// =========================

// Submit offline payment with proof
const submitOfflinePayment = async (req, res) => {
  console.log("DEBUG: submitOfflinePayment called");
  console.log("DEBUG: Request body:", req.body);
  console.log("DEBUG: Request file:", req.file);
  console.log("DEBUG: User ID:", req.user._id);
  
  const { courseId, method, amount, transactionId, referenceNote } = req.body;
  const userId = req.user._id;

  console.log("DEBUG: Parsed values:");
  console.log("DEBUG: courseId:", courseId, "type:", typeof courseId);
  console.log("DEBUG: method:", method, "type:", typeof method);
  console.log("DEBUG: amount:", amount, "type:", typeof amount);
  console.log("DEBUG: transactionId:", transactionId, "type:", typeof transactionId);
  console.log("DEBUG: referenceNote:", referenceNote, "type:", typeof referenceNote);

  if (!courseId || !method || !amount) {
    return res.status(400).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Course ID, payment method, and amount are required",
    });
  }

  const validMethods = [
    PAYMENT_CONFIG.METHODS.BKASH_MANUAL,
    PAYMENT_CONFIG.METHODS.NAGAD_MANUAL,
    PAYMENT_CONFIG.METHODS.BANK_TRANSFER,
    PAYMENT_CONFIG.METHODS.CASH_OFFICE
  ];
  if (!validMethods.includes(method)) {
    return res.status(400).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Invalid payment method for offline payment",
    });
  }

  if (!req.file) {
    return res.status(400).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment proof file is required",
    });
  }

  try {
    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course || course.status !== "published" || course.approvalStatus !== "approved") {
      return res.status(404).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Course not found or not available for purchase",
      });
    }

    // Check if already enrolled
    const isEnrolled = course.students.some(
      (student) => student.studentId === userId.toString()
    );

    if (isEnrolled) {
      // Check if also in StudentCourses, if not, add it to sync
      const studentCourses = await StudentCourses.findOne({ userId: userId.toString() });
      const courseExistsInStudentCourses = studentCourses?.courses?.some(
        (c) => c.courseId === courseId.toString()
      );

      if (!courseExistsInStudentCourses) {
        // Sync: add to StudentCourses
        if (!studentCourses) {
          const newStudentCourses = new StudentCourses({
            userId: userId.toString(),
            courses: [{
              courseId: courseId.toString(),
              title: course.title,
              instructorId: course.instructorId,
              instructorName: course.instructorName,
              dateOfPurchase: new Date(),
              courseImage: course.image,
            }]
          });
          await newStudentCourses.save();
        } else {
          studentCourses.courses.push({
            courseId: courseId.toString(),
            title: course.title,
            instructorId: course.instructorId,
            instructorName: course.instructorName,
            dateOfPurchase: new Date(),
            courseImage: course.image,
          });
          await studentCourses.save();
        }
        console.log("Synced enrollment: added course to StudentCourses");
      }

      return res.status(400).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "You are already enrolled in this course",
      });
    }

    // Check for existing pending payment
    const existingPayment = await Payment.findOne({
      userId,
      courseId,
      [PAYMENT_CONFIG.FIELDS.STATUS]: PAYMENT_CONFIG.STATUSES.PENDING,
      [PAYMENT_CONFIG.FIELDS.METHOD]: { $in: validMethods },
    });

    if (existingPayment) {
      return res.status(400).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "You already have a pending offline payment for this course",
      });
    }

    const paymentTransactionId = transactionId || generateTransactionId();

    // Check if transactionId already exists
    const existingTransaction = await Payment.findOne({ [PAYMENT_CONFIG.FIELDS.TRANSACTION_ID]: paymentTransactionId });
    if (existingTransaction) {
      return res.status(400).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "This transaction ID has already been used. Please use a different transaction ID.",
      });
    }

    const proofUrl = `${req.protocol}://${req.get("host")}/uploads/${req.file.filename}`;

    // Create payment record
    const payment = new Payment({
      userId,
      courseId,
      [PAYMENT_CONFIG.FIELDS.AMOUNT]: parseFloat(amount),
      currency: "BDT",
      [PAYMENT_CONFIG.FIELDS.METHOD]: method,
      [PAYMENT_CONFIG.FIELDS.TRANSACTION_ID]: paymentTransactionId,
      [PAYMENT_CONFIG.FIELDS.STATUS]: PAYMENT_CONFIG.STATUSES.PENDING,
      offlineProofURL: proofUrl,
      [PAYMENT_CONFIG.FIELDS.REFERENCE_NOTE]: referenceNote || "",
    });

    await payment.save();

    res.status(201).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: true,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Offline payment submitted successfully. Waiting for admin verification.",
      [PAYMENT_CONFIG.RESPONSE_FORMAT.DATA]: {
        [PAYMENT_CONFIG.FIELDS.TRANSACTION_ID]: paymentTransactionId,
        proofUrl,
      },
    });
  } catch (error) {
    console.error("Offline payment submission error:", error);
    res.status(500).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Failed to submit offline payment",
    });
  }
};

// List pending offline payments (Admin only)
const listPendingOfflinePayments = async (req, res) => {
  const { status = PAYMENT_CONFIG.STATUSES.PENDING } = req.query;

  try {
    const payments = await Payment.find({
      [PAYMENT_CONFIG.FIELDS.STATUS]: status,
      [PAYMENT_CONFIG.FIELDS.METHOD]: {
        $in: [
          PAYMENT_CONFIG.METHODS.BKASH_MANUAL,
          PAYMENT_CONFIG.METHODS.NAGAD_MANUAL,
          PAYMENT_CONFIG.METHODS.BANK_TRANSFER,
          PAYMENT_CONFIG.METHODS.CASH_OFFICE
        ]
      },
    })
      .populate("userId", "userName userEmail")
      .populate("courseId", "title pricing")
      .sort({ createdAt: -1 });

    res.status(200).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: true,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Pending offline payments retrieved successfully",
      [PAYMENT_CONFIG.RESPONSE_FORMAT.DATA]: payments,
    });
  } catch (error) {
    console.error("List pending payments error:", error);
    res.status(500).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Failed to retrieve pending payments",
    });
  }
};

// Verify offline payment (Admin only)
const verifyOfflinePayment = async (req, res) => {
  const { id } = req.params;
  const { [PAYMENT_CONFIG.FIELDS.ADMIN_NOTE]: adminNote } = req.body;

  try {
    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment not found",
      });
    }

    if (![PAYMENT_CONFIG.METHODS.BKASH_MANUAL, PAYMENT_CONFIG.METHODS.NAGAD_MANUAL, PAYMENT_CONFIG.METHODS.BANK_TRANSFER, PAYMENT_CONFIG.METHODS.CASH_OFFICE].includes(payment[PAYMENT_CONFIG.FIELDS.METHOD])) {
      return res.status(400).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "This endpoint is only for offline payments",
      });
    }

    if (payment[PAYMENT_CONFIG.FIELDS.STATUS] !== PAYMENT_CONFIG.STATUSES.PENDING) {
      return res.status(400).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment is not in pending status",
      });
    }

    payment[PAYMENT_CONFIG.FIELDS.STATUS] = PAYMENT_CONFIG.STATUSES.VERIFIED;
    if (adminNote) {
      payment[PAYMENT_CONFIG.FIELDS.ADMIN_NOTE] = adminNote;
    }
    await payment.save();

    // Enroll student
    const enrollmentResult = await enrollStudentInCourse(payment.userId, payment.courseId);
    if (!enrollmentResult.success) {
      return res.status(500).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment verified but enrollment failed: " + enrollmentResult.error,
      });
    }

    res.status(200).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: true,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment verified and student enrolled successfully",
    });
  } catch (error) {
    console.error("Payment verification error:", error);
    res.status(500).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Failed to verify payment",
    });
  }
};

// Reject offline payment (Admin only)
const rejectOfflinePayment = async (req, res) => {
  const { id } = req.params;
  const { [PAYMENT_CONFIG.FIELDS.ADMIN_NOTE]: adminNote } = req.body;

  if (!adminNote) {
    return res.status(400).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Admin note is required when rejecting payment",
    });
  }

  try {
    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment not found",
      });
    }

    if (![PAYMENT_CONFIG.METHODS.BKASH_MANUAL, PAYMENT_CONFIG.METHODS.NAGAD_MANUAL, PAYMENT_CONFIG.METHODS.BANK_TRANSFER, PAYMENT_CONFIG.METHODS.CASH_OFFICE].includes(payment[PAYMENT_CONFIG.FIELDS.METHOD])) {
      return res.status(400).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "This endpoint is only for offline payments",
      });
    }

    if (payment[PAYMENT_CONFIG.FIELDS.STATUS] !== PAYMENT_CONFIG.STATUSES.PENDING) {
      return res.status(400).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment is not in pending status",
      });
    }

    payment[PAYMENT_CONFIG.FIELDS.STATUS] = PAYMENT_CONFIG.STATUSES.FAILED;
    payment[PAYMENT_CONFIG.FIELDS.ADMIN_NOTE] = adminNote;
    await payment.save();

    res.status(200).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: true,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment rejected successfully",
    });
  } catch (error) {
    console.error("Payment rejection error:", error);
    res.status(500).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Failed to reject payment",
    });
  }
};

// =========================
// Admin Payment Management
// =========================

// Get all payments (Admin only)
const getAllPayments = async (req, res) => {
  const { page = 1, limit = 10, status, method, userId, courseId } = req.query;

  try {
    const query = {};
    if (status) query[PAYMENT_CONFIG.FIELDS.STATUS] = status;
    if (method) query[PAYMENT_CONFIG.FIELDS.METHOD] = method;
    if (userId) query.userId = userId;
    if (courseId) query.courseId = courseId;

    const payments = await Payment.find(query)
      .populate("userId", "userName userEmail")
      .populate("courseId", "title pricing")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: true,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payments retrieved successfully",
      [PAYMENT_CONFIG.RESPONSE_FORMAT.DATA]: {
        payments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalPayments: total,
        },
      },
    });
  } catch (error) {
    console.error("Get all payments error:", error);
    res.status(500).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Failed to retrieve payments",
    });
  }
};

// Get payment by ID (Admin only)
const getPaymentById = async (req, res) => {
  const { id } = req.params;

  try {
    const payment = await Payment.findById(id)
      .populate("userId", "userName userEmail")
      .populate("courseId", "title pricing instructorName");

    if (!payment) {
      return res.status(404).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment not found",
      });
    }

    res.status(200).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: true,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment details retrieved successfully",
      [PAYMENT_CONFIG.RESPONSE_FORMAT.DATA]: payment,
    });
  } catch (error) {
    console.error("Get payment by ID error:", error);
    res.status(500).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Failed to retrieve payment details",
    });
  }
};

// Update payment status (Admin only)
const updatePaymentStatus = async (req, res) => {
  const { id } = req.params;
  const { [PAYMENT_CONFIG.FIELDS.STATUS]: status, [PAYMENT_CONFIG.FIELDS.ADMIN_NOTE]: adminNote } = req.body;

  const validStatuses = Object.values(PAYMENT_CONFIG.STATUSES);
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Invalid status. Must be one of: " + validStatuses.join(", "),
    });
  }

  try {
    const payment = await Payment.findById(id);
    if (!payment) {
      return res.status(404).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment not found",
      });
    }

    const oldStatus = payment[PAYMENT_CONFIG.FIELDS.STATUS];
    payment[PAYMENT_CONFIG.FIELDS.STATUS] = status;
    if (adminNote) {
      payment[PAYMENT_CONFIG.FIELDS.ADMIN_NOTE] = adminNote;
    }
    await payment.save();

    // If status changed to verified and was not verified before, enroll student
    if (status === PAYMENT_CONFIG.STATUSES.VERIFIED && oldStatus !== PAYMENT_CONFIG.STATUSES.VERIFIED) {
      const enrollmentResult = await enrollStudentInCourse(payment.userId, payment.courseId);
      if (!enrollmentResult.success) {
        return res.status(500).json({
          [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
          [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment status updated but enrollment failed: " + enrollmentResult.error,
        });
      }
    }

    res.status(200).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: true,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment status updated successfully",
    });
  } catch (error) {
    console.error("Update payment status error:", error);
    res.status(500).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Failed to update payment status",
    });
  }
};

// =========================
// Student Payment History
// =========================

// Get user's payments
const getMyPayments = async (req, res) => {
  const userId = req.user._id;
  const { page = 1, limit = 10, status } = req.query;

  try {
    const query = { userId };
    if (status) query[PAYMENT_CONFIG.FIELDS.STATUS] = status;

    const payments = await Payment.find(query)
      .populate("courseId", "title pricing instructorName image")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Payment.countDocuments(query);

    res.status(200).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: true,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Your payments retrieved successfully",
      [PAYMENT_CONFIG.RESPONSE_FORMAT.DATA]: {
        payments,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / limit),
          totalPayments: total,
        },
      },
    });
  } catch (error) {
    console.error("Get my payments error:", error);
    res.status(500).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Failed to retrieve your payments",
    });
  }
};

// Get payment details by ID (User's own payment)
const getPaymentDetails = async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;

  try {
    const payment = await Payment.findOne({ _id: id, userId })
      .populate("userId", "userName userEmail mobile")
      .populate("courseId", "title");

    if (!payment) {
      return res.status(404).json({
        [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
        [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment not found",
      });
    }

    // Transform the response to match required format
    const transformedPayment = {
      _id: payment._id,
      amount: payment.amount,
      method: payment.method,
      status: payment.status === 'verified' ? 'approved' : payment.status === 'failed' ? 'rejected' : payment.status,
      transactionId: payment.transactionId,
      createdAt: payment.createdAt,
      student: {
        name: payment.userId?.userName || 'Not provided',
        mobile: payment.userId?.mobile || 'Not provided',
        email: payment.userId?.userEmail || 'Not provided',
      },
      course: {
        title: payment.courseId?.title || 'Not provided',
      },
      adminNote: payment.adminNote,
      referenceNote: payment.referenceNote,
      offlineProofURL: payment.offlineProofURL,
    };

    res.status(200).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: true,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Payment details retrieved successfully",
      [PAYMENT_CONFIG.RESPONSE_FORMAT.DATA]: transformedPayment,
    });
  } catch (error) {
    console.error("Get payment details error:", error);
    res.status(500).json({
      [PAYMENT_CONFIG.RESPONSE_FORMAT.SUCCESS]: false,
      [PAYMENT_CONFIG.RESPONSE_FORMAT.MESSAGE]: "Failed to retrieve payment details",
    });
  }
};

module.exports = {
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
};