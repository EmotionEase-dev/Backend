import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
const submissions = []; // In-memory storage (consider using a database in production)

// Email configuration with improved error handling
const createTransporter = () => {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email credentials not configured');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    pool: true,
    rateLimit: true,
    maxConnections: 1,
    maxMessages: 5
  });
};

const transporter = createTransporter();

// Enhanced validation rules
const contactValidationRules = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .trim()
    .escape()
    .isLength({ max: 100 }).withMessage('Name must be less than 100 characters'),
  
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Email is invalid')
    .normalizeEmail()
    .isLength({ max: 255 }).withMessage('Email must be less than 255 characters'),
  
  body('phone')
    .optional()
    .trim()
    .escape()
    .isLength({ max: 20 }).withMessage('Phone must be less than 20 characters')
    .matches(/^[0-9+() -]*$/).withMessage('Phone contains invalid characters')
];

// Improved submit contact form handler
router.post('/submit', contactValidationRules, async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array({ onlyFirstError: true }) 
    });
  }

  const { name, email, phone } = req.body;
  
  const submission = {
    id: Date.now().toString(),
    name,
    email,
    phone: phone || null,
    date: new Date().toISOString(),
    status: 'pending'
  };

  try {
    // Save submission
    submissions.push(submission);
    console.log('New contact form submission:', submission);

    // Generate email templates
    const [adminEmailHtml, userEmailHtml] = await Promise.all([
      generateAdminEmail(submission),
      generateUserEmail(submission)
    ]);

    if (!process.env.ADMIN_EMAIL) {
      throw new Error('Admin email not configured');
    }

    // Configure email options
    const mailOptions = {
      admin: {
        from: `"Company Support" <${process.env.EMAIL_USER}>`,
        to: process.env.ADMIN_EMAIL,
        subject: `New Contact Submission from ${name}`,
        html: adminEmailHtml,
        priority: 'high'
      },
      user: {
        from: `"Company Support" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Thank you for contacting us',
        html: userEmailHtml
      }
    };

    // Send emails in parallel
    await Promise.all([
      transporter.sendMail(mailOptions.admin),
      transporter.sendMail(mailOptions.user)
    ]);

    submission.status = 'completed';
    
    return res.status(200).json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
      data: {
        id: submission.id,
        name: submission.name,
        email: submission.email
      }
    });

  } catch (error) {
    console.error('Submission error:', error);
    submission.status = 'failed';

    const statusCode = error.message.includes('credentials') ? 500 : 500;
    
    return res.status(statusCode).json({
      success: false,
      message: error.message.includes('credentials') 
        ? 'Service temporarily unavailable' 
        : 'Failed to process your submission. Please try again later.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Enhanced email template generators
function generateAdminEmail(submission) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
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
          <p><strong>Name:</strong> ${submission.name}</p>
          <p><strong>Email:</strong> <a href="mailto:${submission.email}">${submission.email}</a></p>
          ${submission.phone ? `<p><strong>Phone:</strong> <a href="tel:${submission.phone.replace(/[^0-9+]/g, '')}">${submission.phone}</a></p>` : ''}
          <p><strong>Date:</strong> ${new Date(submission.date).toLocaleString()}</p>
          <p><strong>Reference ID:</strong> ${submission.id}</p>
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
        <p>Dear ${submission.name},</p>
        <p>We've received your message and our team will review it shortly. Here's a summary of your submission:</p>
        
        <ul>
          <li><strong>Reference ID:</strong> ${submission.id}</li>
          <li><strong>Submitted:</strong> ${new Date(submission.date).toLocaleString()}</li>
        </ul>
        
        <p>We typically respond within 24 hours. If you have urgent inquiries, please call our support line.</p>
        
        <div class="footer">
          <p>Best regards,<br>The Company Team</p>
          <p><small>This is an automated message. Please do not reply directly to this email.</small></p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export const SubDomainContactRouter = router;