// routes/SignUp.js
import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
let signups = []; // In-memory storage (replace with database in production)

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Validation rules
const signupValidationRules = [
  body('name')
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 3 }).withMessage('Name must be at least 3 characters')
    .trim()
    .escape(),
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Email is invalid')
    .normalizeEmail(),
  body('phone')
    .notEmpty().withMessage('Phone number is required')
    .isMobilePhone().withMessage('Phone number is invalid')
    .isLength({ min: 10, max: 10 }).withMessage('Phone number must be 10 digits')
    .trim()
    .escape()
];

/**
 * @route POST /signup
 * @desc Register a new user
 * @access Public
 */
router.post('/', signupValidationRules, async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }

  const { name, email, phone } = req.body;
  
  const signup = {
    id: Date.now(),
    name,
    email,
    phone,
    date: new Date().toISOString(),
    source: 'website_signup'
  };

  try {
    // Save to temporary storage
    signups.push(signup);
    console.log('New signup:', signup);

    // Email generation
    const adminEmailHtml = generateAdminSignupEmail(signup);
    const userEmailHtml = generateUserSignupEmail(signup);

    // Email configurations
    const adminMailOptions = {
      from: `"EmotionEase Signups" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL || 'emotionease@gmail.com',
      subject: `New Signup: ${name}`,
      html: adminEmailHtml
    };

    const userMailOptions = {
      from: `"EmotionEase" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to EmotionEase!',
      html: userEmailHtml
    };

    // Send emails
    await transporter.sendMail(adminMailOptions);
    await transporter.sendMail(userMailOptions);

    res.status(200).json({
      success: true,
      message: 'Thank you for signing up! We will contact you soon.',
      data: signup
    });

  } catch (error) {
    console.error('Signup processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Signup processed but email sending failed',
      error: error.message
    });
  }
});

/**
 * @route GET /signups
 * @desc Get all signups (for testing)
 * @access Private
 */
router.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    count: signups.length,
    data: signups
  });
});

// Email template generators
function generateAdminSignupEmail(signup) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Signup Notification</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #198754; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; background-color: #f8f9fa; border-radius: 0 0 5px 5px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; width: 30%; }
        .alert { padding: 15px; margin-bottom: 20px; border-radius: 4px; }
        .alert-success { background-color: #d4edda; color: #155724; }
        .btn { display: inline-block; padding: 10px 20px; margin: 10px 5px; text-decoration: none; border-radius: 4px; }
        .btn-primary { background-color: #007bff; color: white; }
        .footer { margin-top: 20px; padding-top: 20px; text-align: center; font-size: 0.9em; color: #6c757d; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>New EmotionEase Signup</h2>
        <p>Potential client interested in our services</p>
      </div>
      
      <div class="content">
        <div class="alert alert-success">
          <strong>New Lead:</strong> Please follow up within 24 hours.
        </div>
        
        <table>
          <tr>
            <th>Name</th>
            <td>${signup.name}</td>
          </tr>
          <tr>
            <th>Email</th>
            <td><a href="mailto:${signup.email}">${signup.email}</a></td>
          </tr>
          <tr>
            <th>Phone</th>
            <td><a href="tel:${signup.phone}">${signup.phone}</a></td>
          </tr>
          <tr>
            <th>Date</th>
            <td>${new Date(signup.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</td>
          </tr>
        </table>
        
        <div class="text-center mt-4">
  <a href="mailto:${signup.email}" class="btn btn-primary text-white me-2">Email ${signup.name.split(' ')[0]}</a>
  <a href="tel:${signup.phone}" class="btn btn-primary text-white">Call ${signup.name.split(' ')[0]}</a>
</div>
        
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} EmotionEase. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

function generateUserSignupEmail(signup) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to EmotionEase</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #198754; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { padding: 20px; background-color: #f8f9fa; border-radius: 0 0 5px 5px; }
        .alert { padding: 15px; margin-bottom: 20px; border-radius: 4px; }
        .alert-success { background-color: #d4edda; color: #155724; }
        ol { padding-left: 20px; }
        li { margin-bottom: 10px; }
        .footer { margin-top: 20px; padding-top: 20px; text-align: center; font-size: 0.9em; color: #6c757d; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>Welcome to EmotionEase, ${signup.name.split(' ')[0]}!</h2>
        <p>Your journey to emotional wellness begins here</p>
      </div>
      
      <div class="content">
        <div class="alert alert-success">
          <h3>Thank you for signing up!</h3>
          <p>We've received your information and will contact you soon.</p>
        </div>
        
        <h4>What to expect next:</h4>
        <ol>
          <li>Our team will review your information</li>
          <li>A specialist will contact you within 24 hours</li>
          <li>We'll schedule your initial consultation</li>
        </ol>
        
        <p><strong>Need immediate help?</strong><br>
        Call us at +91 9345330187 (9AM-9PM IST)</p>
        
        <div class="footer">
          <p>This is an automated message. Please don't reply.</p>
          <p>&copy; ${new Date().getFullYear()} EmotionEase</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export default router;