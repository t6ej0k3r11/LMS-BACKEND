/**
 * Certificate Routes - Backend Implementation Proposal
 *
 * This file contains the proposed routes for certificate functionality.
 * To implement this feature, add this route file to your student routes.
 */

const express = require('express');
const { downloadCertificate } = require('../../controllers/certificate-controller');
const { authenticate } = require('../../middleware/auth-middleware');
const { studentMiddleware } = require('../../middleware/student-middleware');

const router = express.Router();

// All certificate routes require authentication and student role
router.use(authenticate);
router.use(studentMiddleware);

/**
 * Download certificate
 * GET /student/certificates/:userId/:courseId/download
 *
 * Generates and downloads a PDF certificate for course completion
 */
router.get('/:userId/:courseId/download', downloadCertificate);

module.exports = router;