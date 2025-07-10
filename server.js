import express from 'express';
import cors from 'cors';
import contactRoutes from './routes/contact.js';
import errorHandler from './middlewares/errorHandler.js';
import SignUpRouter from './routes/SignUp.js';
import SubDomainContactRouter from './routes/contact.js'; // Add this import

import dotenv from 'dotenv';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/contact', contactRoutes);
app.use('/api/signup', SignUpRouter);
app.use('/subdomain-contact', SubDomainContactRouter);

// Error handling middleware
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});