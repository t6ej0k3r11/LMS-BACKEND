/**
 * Certificate Controller - Backend Implementation Proposal
 *
 * This file contains the proposed backend implementation for certificate generation.
 * To implement this feature, add this controller to your backend and install required dependencies.
 *
 * Required Dependencies:
 * npm install pdfkit
 * npm install @pdf-lib/fontkit (optional, for custom fonts)
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const Course = require('../models/Course');
const User = require('../models/User');
const CourseProgress = require('../models/CourseProgress');

/**
 * Generate unique certificate ID
 */
function generateCertificateId(userId, courseId) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const userIdLast6 = userId.slice(-6).toUpperCase();
  const courseIdLast6 = courseId.slice(-6).toUpperCase();
  const random4 = Math.random().toString(36).substring(2, 6).toUpperCase();

  return `CERT-${year}${month}${day}-${userIdLast6}-${courseIdLast6}-${random4}`;
}

/**
 * Check if student is eligible for certificate
 */
async function checkCertificateEligibility(userId, courseId) {
  try {
    // Get course progress
    const progress = await CourseProgress.findOne({ userId, courseId });
    if (!progress) {
      return { eligible: false, reason: 'No progress found' };
    }

    // Calculate completion percentage
    const course = await Course.findById(courseId);
    if (!course) {
      return { eligible: false, reason: 'Course not found' };
    }

    const completionPercentage = progress.calculateCompletionPercentage(course);

    // Check eligibility criteria
    if (completionPercentage < 80) {
      return { eligible: false, reason: `Completion ${completionPercentage}% (80% required)` };
    }

    // Check if final quiz is passed (if exists)
    if (course.quiz && progress.quizAttempts) {
      const finalAttempt = progress.quizAttempts
        .filter(attempt => attempt.quizId.toString() === course.quiz.toString())
        .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];

      if (!finalAttempt || !finalAttempt.passed) {
        return { eligible: false, reason: 'Final assessment not passed' };
      }
    }

    return { eligible: true, completionPercentage };
  } catch (error) {
    console.error('Error checking certificate eligibility:', error);
    return { eligible: false, reason: 'Error checking eligibility' };
  }
}

/**
 * Generate certificate PDF
 */
function generateCertificatePDF(certificateData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 50
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });

      // Certificate background and styling
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f8f9fa');

      // Border
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40)
         .lineWidth(3)
         .stroke('#1a365d');

      // Header
      doc.fillColor('#1a365d')
         .fontSize(36)
         .font('Helvetica-Bold')
         .text('CERTIFICATE OF COMPLETION', 0, 80, {
           align: 'center',
           width: doc.page.width
         });

      // Subtitle
      doc.fillColor('#4a5568')
         .fontSize(18)
         .font('Helvetica')
         .text('This certifies that', 0, 140, {
           align: 'center',
           width: doc.page.width
         });

      // Student name
      doc.fillColor('#1a365d')
         .fontSize(32)
         .font('Helvetica-Bold')
         .text(certificateData.studentName, 0, 180, {
           align: 'center',
           width: doc.page.width
         });

      // Completion text
      doc.fillColor('#4a5568')
         .fontSize(16)
         .font('Helvetica')
         .text('has successfully completed the course', 0, 240, {
           align: 'center',
           width: doc.page.width
         });

      // Course title
      doc.fillColor('#1a365d')
         .fontSize(24)
         .font('Helvetica-Bold')
         .text(`"${certificateData.courseTitle}"`, 0, 280, {
           align: 'center',
           width: doc.page.width
         });

      // Instructor and date
      doc.fillColor('#4a5568')
         .fontSize(14)
         .font('Helvetica')
         .text(`Instructor: ${certificateData.instructorName}`, 0, 340, {
           align: 'center',
           width: doc.page.width
         });

      doc.text(`Completed on: ${certificateData.completionDate}`, 0, 365, {
        align: 'center',
        width: doc.page.width
      });

      // Certificate ID
      doc.fillColor('#718096')
         .fontSize(10)
         .text(`Certificate ID: ${certificateData.certificateId}`, 0, 420, {
           align: 'center',
           width: doc.page.width
         });

      // Footer
      doc.fillColor('#a0aec0')
         .fontSize(10)
         .text('LMS Bangladesh - Professional Learning Platform', 0, doc.page.height - 60, {
           align: 'center',
           width: doc.page.width
         });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Download certificate endpoint
 * GET /student/certificates/:userId/:courseId/download
 */
const downloadCertificate = async (req, res) => {
  try {
    const { userId, courseId } = req.params;

    // Verify user owns this certificate request
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to access this certificate'
      });
    }

    // Check eligibility
    const eligibility = await checkCertificateEligibility(userId, courseId);
    if (!eligibility.eligible) {
      return res.status(400).json({
        success: false,
        message: `Not eligible for certificate: ${eligibility.reason}`
      });
    }

    // Get user and course data
    const [user, course] = await Promise.all([
      User.findById(userId).select('userName firstName lastName email'),
      Course.findById(courseId).select('title description instructorName')
    ]);

    if (!user || !course) {
      return res.status(404).json({
        success: false,
        message: 'User or course not found'
      });
    }

    // Generate certificate data
    const certificateId = generateCertificateId(userId, courseId);
    const certificateData = {
      certificateId,
      studentName: user.userName || `${user.firstName} ${user.lastName}`,
      studentEmail: user.email,
      courseTitle: course.title,
      courseDescription: course.description,
      instructorName: course.instructorName,
      completionDate: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      completionPercentage: eligibility.completionPercentage,
      issuedDate: new Date().toISOString()
    };

    // Generate PDF
    const pdfBuffer = await generateCertificatePDF(certificateData);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="Certificate_${course.title.replace(/\s+/g, '_')}_${certificateId}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    // Send PDF
    res.send(pdfBuffer);

  } catch (error) {
    console.error('Certificate download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate certificate'
    });
  }
};

module.exports = {
  downloadCertificate
};