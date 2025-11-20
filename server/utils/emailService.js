const nodemailer = require("nodemailer");
const ejs = require("ejs");
const path = require("path");
const fs = require("fs").promises;

// Create a test account if in development
const createTransporter = async () => {
  // In production, use real SMTP credentials from environment variables
  if (process.env.NODE_ENV === "production") {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD,
      },
    });
  }

  // In development, use ethereal.email for testing
  const testAccount = await nodemailer.createTestAccount();
  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });

  // Log the test account details for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Test account created:", {
      user: testAccount.user,
      pass: testAccount.pass,
      web: "https://ethereal.email",
    });
  }

  return transporter;
};

// Render email template
const renderTemplate = async (templateName, data) => {
  try {
    const templatePath = path.join(
      __dirname,
      "..",
      "templates",
      "emails",
      `${templateName}.ejs`
    );
    const template = await fs.readFile(templatePath, "utf-8");
    return ejs.render(template, data);
  } catch (error) {
    console.error("Error rendering email template:", error);
    throw new Error("Failed to render email template");
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetLink) => {
  try {
    const transporter = await createTransporter();

    // In production, use a proper email template
    const html = await renderTemplate("password-reset", { resetLink });

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || "LMS"}" <${
        process.env.EMAIL_FROM || "noreply@lms.com"
      }>`,
      to: email,
      subject: "Password Reset Request",
      html:
        html ||
        `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset. Click the link below to set a new password:</p>
        <p><a href="${resetLink}">Reset Password</a></p>
        <p>This link will expire in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    };

    const info = await transporter.sendMail(mailOptions);

    if (process.env.NODE_ENV !== "production") {
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }

    return info;
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
};

const sendInstructorDecisionEmail = async (
  email,
  userName,
  decision,
  reason = null
) => {
  try {
    const transporter = await createTransporter();

    const subject =
      decision === "approved"
        ? "Instructor Application Approved"
        : "Instructor Application Rejected";
    const greeting = `Dear ${userName},`;
    const message =
      decision === "approved"
        ? "Congratulations! Your instructor application has been approved. You can now create and manage courses on our platform."
        : `We regret to inform you that your instructor application has been rejected. ${
            reason ? `Reason: ${reason}` : ""
          }`;

    const html = `
      <h2>${subject}</h2>
      <p>${greeting}</p>
      <p>${message}</p>
      <p>Best regards,<br>LMS Team</p>
    `;

    const mailOptions = {
      from: `"${process.env.EMAIL_FROM_NAME || "LMS"}" <${
        process.env.EMAIL_FROM || "noreply@lms.com"
      }>`,
      to: email,
      subject,
      html,
    };

    const info = await transporter.sendMail(mailOptions);

    if (process.env.NODE_ENV !== "production") {
      console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    }

    return info;
  } catch (error) {
    console.error("Error sending instructor decision email:", error);
    throw error;
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendInstructorDecisionEmail,
};
