import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

dotenv.config();

const SubDomainContactRouter = Router();

// Rate limiting to prevent abuse
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many contact attempts, please try again later'
});

// In-memory storage with TTL (time-to-live) for demo purposes
const submissions = new Map();
const SUBMISSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

// Clean up old submissions periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, submission] of submissions) {
    if (now - new Date(submission.date).getTime() > SUBMISSION_TTL) {
      submissions.delete(id);
    }
  }
}, 60 * 60 * 1000); // Run hourly

// Email configuration with connection pooling and error handling
const createTransporter = () => {
  const { EMAIL_USER, EMAIL_PASS, EMAIL_SERVICE } = process.env;
  
  if (!EMAIL_USER || !EMAIL_PASS) {
    throw new Error('Email credentials not configured');
  }

  const config = {
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
    rateDelta: 1000, // 1 second
    rateLimit: 5, // max messages per rateDelta
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS
    }
  };

  if (EMAIL_SERVICE === 'gmail') {
    config.service = 'gmail';
  } else {
    config.host = process.env.EMAIL_HOST;
    config.port = parseInt(process.env.EMAIL_PORT);
    config.secure = process.env.EMAIL_SECURE === 'true';
  }

  return nodemailer.createTransport(config);
};

const transporter = createTransporter();

// Enhanced validation rules with sanitization
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

// Improved submit contact form handler
SubDomainContactRouter.post('/submit', contactLimiter, contactValidationRules, async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      message: 'Validation failed',
      errors: errors.array({ onlyFirstError: true }).map(err => ({
        field: err.path,
        message: err.msg
      }))
    });
  }

  const { name, email, phone } = req.body;
  const submissionId = Date.now().toString();
  
  const submission = {
    id: submissionId,
    name,
    email,
    phone: phone || null,
    date: new Date().toISOString(),
    status: 'pending',
    ip: req.ip
  };

  try {
    // Save submission
    submissions.set(submissionId, submission);
    console.log('New contact form submission:', { id: submissionId, email });

    // Generate and send emails in parallel
    const [adminEmail, userEmail] = await Promise.all([
      generateAdminEmail(submission),
      generateUserEmail(submission)
    ]);

    const mailOptions = {
      admin: {
        from: `"${process.env.EMAIL_FROM_NAME || 'Company Support'}" <${process.env.EMAIL_USER}>`,
        to: "emotionease@gmail.com",
        subject:`New Contact Submission from ${name}`,
        html: adminEmail,
        priority: 'high'
      },
      user: {
        from: `"${process.env.EMAIL_FROM_NAME || 'Company Support'}" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: process.env.USER_EMAIL_SUBJECT || 'Thank you for contacting us',
        html: userEmail
      }
    };

    await Promise.all([
      transporter.sendMail(mailOptions.admin),
      transporter.sendMail(mailOptions.user).catch(err => {
        console.error('Failed to send user email:', err);
        // Don't fail the whole request if user email fails
      })
    ]);

    // Update submission status
    submission.status = 'completed';
    submissions.set(submissionId, submission);
    
    return res.status(200).json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
      data: {
        id: submissionId,
        name: submission.name,
        email: submission.email
      }
    });

  } catch (error) {
    console.error('Submission error:', error);
    
    // Update submission status
    submission.status = 'failed';
    submission.error = error.message;
    submissions.set(submissionId, submission);

    const statusCode = error.message.includes('credentials') ? 503 : 500;
    const userMessage = error.message.includes('credentials') 
      ? 'Service temporarily unavailable' 
      : 'Failed to process your submission. Please try again later.';
    
    return res.status(statusCode).json({
      success: false,
      message: userMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Email template generators with improved security
function generateAdminEmail(submission) {
  const safePhone = submission.phone ? submission.phone.replace(/[^\d+]/g, '') : '';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { color: #28a745; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .footer { margin-top: 20px; font-size: 0.9em; color: #777; }
        .info { margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2 class="header">New Contact Submission</h2>
        <div class="info">
          <p><strong>Name:</strong> ${escapeHtml(submission.name)}</p>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(submission.email)}">${escapeHtml(submission.email)}</a></p>
          ${submission.phone ? `<p><strong>Phone:</strong> <a href="tel:${safePhone}">${escapeHtml(submission.phone)}</a></p>` : ''}
          <p><strong>Date:</strong> ${new Date(submission.date).toLocaleString()}</p>
          <p><strong>Reference ID:</strong> ${submission.id}</p>
          <p><strong>IP Address:</strong> ${submission.ip}</p>
        </div>
        <p>Please respond to this inquiry within 24 hours.</p>
        <div class="footer">
          <p>This is an automated message. Please do not reply directly to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateUserEmail(submission) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { color: #28a745; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        .footer { margin-top: 20px; font-size: 0.9em; color: #777; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2 class="header">Thank You for Contacting Us</h2>
        <p>Dear ${escapeHtml(submission.name)},</p>
        <p>We've received your message and our team will review it shortly. Here's a summary of your submission:</p>
        
        <ul>
          <li><strong>Reference ID:</strong> ${submission.id}</li>
          <li><strong>Submitted:</strong> ${new Date(submission.date).toLocaleString()}</li>
        </ul>
        
        <p>We typically respond within 24 hours. If you have urgent inquiries, please call our support line.</p>
        
        <div class="footer">
          <p>Best regards,<br>${escapeHtml(process.env.EMAIL_FROM_NAME || 'The Company Team')}</p>
          <p><small>This is an automated message. Please do not reply directly to this email.</small></p>
        </div>
      </div>
    </body>
    </html>
  `;
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