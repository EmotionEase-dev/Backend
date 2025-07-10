import express from 'express';
import { body, validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const SubDomainContactRouter = express.Router();

// Email configuration with your specific details
const emailConfig = {
  service: 'gmail',
  auth: {
    user: 'emotionease@gmail.com',
    pass: process.env.EMAIL_PASS // Password should be in environment variables
  },
  pool: true,
  maxConnections: 5,
  maxMessages: 100
};

const transporter = nodemailer.createTransport(emailConfig);

// Rate limiting to prevent abuse
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many contact attempts, please try again later'
});

// Validation rules
const contactValidationRules = [
  body('name')
    .trim()
    .escape()
    .notEmpty().withMessage('Name is required')
    .isLength({ max: 100 }).withMessage('Name must be less than 100 characters'),
  
  body('email')
    .trim()
    .normalizeEmail()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Email is invalid')
    .isLength({ max: 255 }).withMessage('Email must be less than 255 characters'),
  
  body('phone')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 20 }).withMessage('Phone must be less than 20 characters')
    .matches(/^[\d\s+()\-]*$/).withMessage('Phone contains invalid characters')
];

// Contact form submission endpoint
SubDomainContactRouter.post('/submit', contactLimiter, contactValidationRules, async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }

  const { name, email, phone } = req.body;

  try {
    // Send emails to both admin and user
    await Promise.all([
      sendAdminEmail(name, email, phone, req.ip),
      sendUserEmail(name, email)
    ]);

    return res.status(200).json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.'
    });

  } catch (error) {
    console.error('Error processing contact form:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process your submission. Please try again later.'
    });
  }
});

// Helper function to send email to admin
async function sendAdminEmail(name, email, phone, ip) {
  const mailOptions = {
    from: `"Emotionease Contact Form" <emotionease@gmail.com>`,
    to: 'emotionease@gmail.com', // Admin email
    subject: `New Contact Form Submission from ${name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Contact Form Submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
        ${phone ? `<p><strong>Phone:</strong> ${escapeHtml(phone)}</p>` : ''}
        <p><strong>IP Address:</strong> ${ip}</p>
        <p><strong>Submitted At:</strong> ${new Date().toLocaleString()}</p>
        <p style="margin-top: 20px;">Please respond to this inquiry within 24 hours.</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Helper function to send confirmation email to user
async function sendUserEmail(name, email) {
  const mailOptions = {
    from: `"Emotionease" <emotionease@gmail.com>`,
    to: email,
    subject: 'Thank you for contacting Emotionease',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hello ${escapeHtml(name)},</h2>
        <p>Thank you for reaching out to Emotionease! We've received your message and our team will review it shortly.</p>
        <p>Here's a summary of your submission:</p>
        <ul>
          <li><strong>Name:</strong> ${escapeHtml(name)}</li>
          <li><strong>Email:</strong> ${escapeHtml(email)}</li>
          <li><strong>Submitted At:</strong> ${new Date().toLocaleString()}</li>
        </ul>
        <p>We typically respond within 24 hours. If you have urgent inquiries, please don't hesitate to contact us directly.</p>
        <p style="margin-top: 30px;">Best regards,<br>The Emotionease Team</p>
      </div>
    `
  };

  await transporter.sendMail(mailOptions);
}

// Basic HTML escaping for security
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return unsafe.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default SubDomainContactRouter;