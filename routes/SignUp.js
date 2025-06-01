import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const SignUpRouter = Router();
let signups = []; // In-memory storage for signups

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Validation rules for signup
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

// Submit signup form
router.post('/signup', signupValidationRules, async (req, res) => {
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
    // Save signup
    signups.push(signup);
    console.log('New signup:', signup);

    // Generate email templates
    const adminEmailHtml = generateAdminSignupEmail(signup);
    const userEmailHtml = generateUserSignupEmail(signup);

    // Send email to admin
    const adminMailOptions = {
      from: `"EmotionEase Signups" <${process.env.EMAIL_USER}>`,
      to: process.env.ADMIN_EMAIL || 'emotionease@gmail.com',
      subject: `New Signup: ${name}`,
      html: adminEmailHtml
    };

    // Send confirmation email to user
    const userMailOptions = {
      from: `"EmotionEase" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Welcome to EmotionEase!',
      html: userEmailHtml
    };

    // Send both emails
    await transporter.sendMail(adminMailOptions);
    await transporter.sendMail(userMailOptions);

    res.status(200).json({
      success: true,
      message: 'Thank you for signing up! We will contact you soon.',
      data: signup
    });

  } catch (error) {
    console.error('Signup processing failed:', error);
    res.status(500).json({
      success: false,
      message: 'Signup processed but failed to send confirmation email',
      error: error.message
    });
  }
});

// Get all signups (for testing)
router.get('/signups', (req, res) => {
  res.status(200).json({
    success: true,
    count: signups.length,
    data: signups
  });
});

// Helper function to generate admin signup email template
function generateAdminSignupEmail(signup) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Signup Notification</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .header {
          background-color: #198754;
          color: white;
          padding: 20px;
          border-radius: 5px 5px 0 0;
        }
        .content {
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 0 0 5px 5px;
        }
        .detail-item {
          margin-bottom: 15px;
        }
        .footer {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
          font-size: 0.9em;
          color: #6c757d;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header text-center">
          <h2>New EmotionEase Signup</h2>
          <p class="mb-0">Potential client interested in our services</p>
        </div>
        
        <div class="content">
          <div class="alert alert-success" role="alert">
            <strong>New Lead:</strong> Please follow up within 24 hours.
          </div>
          
          <div class="card mb-4">
            <div class="card-header bg-light">
              <h5 class="mb-0">Signup Details</h5>
            </div>
            <div class="card-body">
              <table class="table table-bordered">
                <tbody>
                  <tr>
                    <th scope="row" style="width: 30%">Name</th>
                    <td>${signup.name}</td>
                  </tr>
                  <tr>
                    <th scope="row">Email</th>
                    <td><a href="mailto:${signup.email}">${signup.email}</a></td>
                  </tr>
                  <tr>
                    <th scope="row">Phone</th>
                    <td><a href="tel:${signup.phone}">${signup.phone}</a></td>
                  </tr>
                  <tr>
                    <th scope="row">Date</th>
                    <td>${new Date(signup.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</td>
                  </tr>
                  <tr>
                    <th scope="row">Source</th>
                    <td><span class="badge bg-primary">${signup.source}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="text-center mt-4">
            <a href="mailto:${signup.email}" class="btn btn-success me-2">Email ${signup.name.split(' ')[0]}</a>
            <a href="tel:${signup.phone}" class="btn btn-outline-success">Call ${signup.name.split(' ')[0]}</a>
          </div>
          
          <div class="footer text-center">
            <p>&copy; ${new Date().getFullYear()} EmotionEase. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

// Helper function to generate user signup email template
function generateUserSignupEmail(signup) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to EmotionEase</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .header {
          background-color: #198754;
          color: white;
          padding: 20px;
          border-radius: 5px 5px 0 0;
        }
        .content {
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 0 0 5px 5px;
        }
        .footer {
          margin-top: 20px;
          padding-top: 20px;
          border-top: 1px solid #dee2e6;
          font-size: 0.9em;
          color: #6c757d;
        }
        .steps {
          counter-reset: step-counter;
          padding-left: 0;
        }
        .steps li {
          list-style: none;
          position: relative;
          padding-left: 45px;
          margin-bottom: 15px;
        }
        .steps li:before {
          counter-increment: step-counter;
          content: counter(step-counter);
          position: absolute;
          left: 0;
          top: 0;
          background: #198754;
          color: white;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          text-align: center;
          line-height: 30px;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      <div class="email-container">
        <div class="header text-center">
          <h2>Welcome to EmotionEase, ${signup.name.split(' ')[0]}!</h2>
          <p class="mb-0">Your journey to emotional wellness begins here</p>
        </div>
        
        <div class="content">
          <div class="alert alert-success" role="alert">
            <h4 class="alert-heading">Thank you for signing up!</h4>
            <p>We've received your information and one of our wellness specialists will contact you soon.</p>
          </div>
          
          <div class="card mb-4">
            <div class="card-header bg-light">
              <h5 class="mb-0">Your Signup Details</h5>
            </div>
            <div class="card-body">
              <table class="table table-bordered">
                <tbody>
                  <tr>
                    <th scope="row" style="width: 30%">Reference ID</th>
                    <td>${signup.id}</td>
                  </tr>
                  <tr>
                    <th scope="row">Date Submitted</th>
                    <td>${new Date(signup.date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="mb-4">
            <h5 class="mb-3">What to Expect Next</h5>
            <ol class="steps">
              <li>Our team will review your information</li>
              <li>A wellness specialist will contact you within 24 hours</li>
              <li>We'll schedule an initial consultation at your convenience</li>
              <li>Begin your personalized emotional wellness journey</li>
            </ol>
          </div>
          
          <div class="alert alert-info">
            <h5 class="alert-heading">Need Immediate Assistance?</h5>
            <p class="mb-2">If you need to speak with someone right away, please call our support line:</p>
            <p class="mb-0"><strong>+91 1234567890</strong> (Available 9AM-9PM IST)</p>
          </div>
          
          <div class="footer text-center">
            <p>This is an automated confirmation. Please do not reply to this email.</p>
            <p>&copy; ${new Date().getFullYear()} EmotionEase. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export default SignUpRouter;