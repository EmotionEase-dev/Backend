import { Router } from 'express';
import { body, validationResult } from 'express-validator';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();
let submissions = []; // In-memory storage

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Validation rules
const contactValidationRules = [
  body('name').notEmpty().withMessage('Name is required').trim().escape(),
  body('email')
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Email is invalid')
    .normalizeEmail(),
  body('category').notEmpty().withMessage('Category is required').trim().escape(),
  body('message').notEmpty().withMessage('Message is required').trim().escape(),
];

// Submit contact form
router.post('/submit', contactValidationRules, async (req, res) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    return res.status(400).json({ 
      success: false, 
      errors: errors.array() 
    });
  }

  const { name, email, phone, category, message,age } = req.body;
  
  const submission = {
    id: Date.now(),
    name,
    email,
    phone: phone || null,
    category,
    age,
    message,
    date: new Date().toISOString()
  };

  try {
    // Save submission
    submissions.push(submission);
    console.log('New contact form submission:', submission);

    // Generate email templates
    const adminEmailHtml = generateAdminEmail(submission);
    const userEmailHtml = generateUserEmail(submission);

    // Send email to admin
    const adminMailOptions = {
      from: `"EmotionEase Support" <${process.env.EMAIL_USER}>`,
      to: 'emotionease@gmail.com',
      subject: `New Contact Form Submission - ${category}`,
      html: adminEmailHtml
    };

    // Send confirmation email to user
    const userMailOptions = {
      from: `"EmotionEase Support" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Thank you for contacting EmotionEase',
      html: userEmailHtml
    };

    // Send both emails
    await transporter.sendMail(adminMailOptions);
    await transporter.sendMail(userMailOptions);

    res.status(200).json({
      success: true,
      message: 'Thank you for contacting us! We will get back to you soon.',
      data: submission
    });

  } catch (error) {
    console.error('Email sending failed:', error);
    res.status(500).json({
      success: false,
      message: 'Form submitted but failed to send confirmation email',
      error: error.message
    });
  }
});

// Get all submissions (for testing)
router.get('/submissions', (req, res) => {
  res.status(200).json({
    success: true,
    count: submissions.length,
    data: submissions
  });
});

// Helper function to generate admin email template
function generateAdminEmail(submission) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>New Contact Submission</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .header {
          background-color: #4a76a8;
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
        .message-box {
          background-color: white;
          border-left: 4px solid #4a76a8;
          padding: 15px;
          margin: 15px 0;
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
          <h2>New Contact Form Submission</h2>
          <p class="mb-0">EmotionEase Support</p>
        </div>
        
        <div class="content">
          <div class="alert alert-primary" role="alert">
            <strong>Action Required:</strong> Please respond to this inquiry within 24-48 hours.
          </div>
          
          <div class="card mb-4">
            <div class="card-header bg-light">
              <h5 class="mb-0">Submission Details</h5>
            </div>
            <div class="card-body">
              <table class="table table-bordered">
                <tbody>
                  <tr>
                    <th scope="row" style="width: 30%">Name</th>
                    <td>${submission.name}</td>
                  </tr>
                  <tr>
                    <th scope="row" style="width: 30%"Age</th>
                    <td>${submission.age}</td>
                  </tr>
                  <tr>
                    <th scope="row">Email</th>
                    <td><a href="mailto:${submission.email}">${submission.email}</a></td>
                  </tr>
                  ${submission.phone ? `
                  <tr>
                    <th scope="row">Phone</th>
                    <td><a href="tel:${submission.phone}">${submission.phone}</a></td>
                  </tr>
                  ` : ''}
                  <tr>
                    <th scope="row">Category</th>
                    <td><span class="badge bg-info">${submission.category}</span></td>
                  </tr>

                  <tr>
                    <th scope="row">Date</th>
                    <td>${new Date(submission.date).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header bg-light">
              <h5 class="mb-0">Message</h5>
            </div>
            <div class="card-body message-box">
              <p>${submission.message.replace(/\n/g, '<br>')}</p>
            </div>
          </div>
          
          <div class="text-center mt-4">
            <a href="mailto:${submission.email}" class="btn btn-primary">Reply to ${submission.name}</a>
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

// Helper function to generate user email template
function generateUserEmail(submission) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Thank You for Contacting Us</title>
      <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
      <style>
        .email-container {
          max-width: 600px;
          margin: 0 auto;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }
        .header {
          background-color: #4a76a8;
          color: white;
          padding: 20px;
          border-radius: 5px 5px 0 0;
        }
        .content {
          padding: 20px;
          background-color: #f8f9fa;
          border-radius: 0 0 5px 5px;
        }
        .message-box {
          background-color: white;
          border-left: 4px solid #4a76a8;
          padding: 15px;
          margin: 15px 0;
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
          <h2>Thank You for Contacting EmotionEase</h2>
          <p class="mb-0">We appreciate you reaching out to us</p>
        </div>
        
        <div class="content">
          <div class="alert alert-success" role="alert">
            <h4 class="alert-heading">Hello, ${submission.name}!</h4>
            <p>We've received your message regarding <strong>${submission.category}</strong> and our team will get back to you soon.</p>
          </div>
          
          <div class="card mb-4">
            <div class="card-header bg-light">
              <h5 class="mb-0">Your Submission Details</h5>
            </div>
            <div class="card-body">
              <table class="table table-bordered">
                <tbody>
                  <tr>
                    <th scope="row" style="width: 30%">Reference ID</th>
                    <td>${submission.id}</td>
                  </tr>
                  <tr>
                    <th scope="row">Category</th>
                    <td><span class="badge bg-info">${submission.category}</span></td>
                  </tr>
                  <tr>
                    <th scope="row">Age</th>
                    <td><span class="badge bg-info">${submission.age}</span></td>
                  </tr>
                  <tr>
                    <th scope="row">Date Submitted</th>
                    <td>${new Date(submission.date).toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="card">
            <div class="card-header bg-light">
              <h5 class="mb-0">Your Message</h5>
            </div>
            <div class="card-body message-box">
              <p>${submission.message.replace(/\n/g, '<br>')}</p>
            </div>
          </div>
          
          <div class="mt-4">
            <h5>What Happens Next?</h5>
            <ol>
              <li>Our team will review your message</li>
              <li>We'll respond to you within 1-2 business days</li>
              <li>For urgent matters, please call our support line</li>
            </ol>
          </div>
          
          <div class="footer text-center">
            <p>This is an automated confirmation. Please do not reply to this email.</p>
            <p>Need immediate assistance? <a href="mailto:support@emotionease.in">Contact our support team</a></p>
            <p>&copy; ${new Date().getFullYear()} EmotionEase. All rights reserved.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

export default router;