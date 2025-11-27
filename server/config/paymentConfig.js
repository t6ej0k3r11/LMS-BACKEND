// Payment Configuration - Centralized for both backend and frontend
const PAYMENT_CONFIG = {
  // API Base URLs
  API_BASE_URL: process.env.API_BASE_URL || 'http://localhost:5000',
  CLIENT_BASE_URL: process.env.CLIENT_URL || 'http://localhost:3000',

  // Payment Routes
  ROUTES: {
    INIT_ONLINE: '/payments/online/init',
    SUCCESS: '/payment/success',
    FAIL: '/payment/fail',
    CANCEL: '/payment/cancel',
    OFFLINE_SUBMIT: '/payments/offline/submit',
    OFFLINE_LIST: '/payments/offline/list',
    OFFLINE_VERIFY: '/payments/offline/verify',
    OFFLINE_REJECT: '/payments/offline/reject',
    MY_PAYMENTS: '/payments/my-payments',
    PAYMENT_DETAILS: '/payments/details',
    ADMIN_PAYMENTS: '/payments/admin',
    ADMIN_PAYMENT_BY_ID: '/payments/admin',
    ADMIN_UPDATE_STATUS: '/payments/admin/update-status',
  },

  // Payment Methods
  METHODS: {
    SSLCOMMERZ: 'sslcommerz',
    AAMARPAY: 'aamarpay',
    BKASH_MANUAL: 'bkash_manual',
    NAGAD_MANUAL: 'nagad_manual',
    BANK_TRANSFER: 'bank_transfer',
    CASH_OFFICE: 'cash_office',
  },

  // Payment Statuses
  STATUSES: {
    PENDING: 'pending',
    PROCESSING: 'processing',
    VERIFIED: 'verified',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
  },

  // Response Format
  RESPONSE_FORMAT: {
    SUCCESS: 'success',
    MESSAGE: 'message',
    DATA: 'data',
  },

  // Field Names
  FIELDS: {
    AMOUNT: 'amount',
    METHOD: 'method',
    TRANSACTION_ID: 'transactionId',
    COURSE_ID: 'courseId',
    STUDENT_ID: 'studentId',
    PROOF_FILE: 'proofFile',
    REFERENCE_NOTE: 'referenceNote',
    STATUS: 'status',
    ADMIN_NOTE: 'adminNote',
  },

  // File Upload
  FILE_UPLOAD: {
    MAX_SIZE: 20 * 1024 * 1024, // 20MB for documents
    ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'],
    UPLOAD_PATH: 'uploads/',
  },

  // Gateway URLs
  GATEWAYS: {
    SSLCOMMERZ: {
      SANDBOX_URL: 'https://sandbox.sslcommerz.com',
      LIVE_URL: 'https://securepay.sslcommerz.com',
      INIT_ENDPOINT: '/gwprocess/v4/api.php',
      VALIDATION_ENDPOINT: '/validator/api/validationserverAPI.php',
    },
    AAMARPAY: {
      SANDBOX_URL: 'https://sandbox.aamarpay.com',
      LIVE_URL: 'https://secure.aamarpay.com',
      INIT_ENDPOINT: '/jsonpost.php',
      VALIDATION_ENDPOINT: '/api/v1/trxcheck/request.php',
    },
  },

  // CORS Origins for payment gateways
  CORS_ORIGINS: [
    'https://sandbox.sslcommerz.com',
    'https://securepay.sslcommerz.com',
    'https://sandbox.aamarpay.com',
    'https://secure.aamarpay.com',
  ],
};

module.exports = PAYMENT_CONFIG;