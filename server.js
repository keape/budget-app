const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const speseRoutes = require('./routes/spese');
const entrateRoutes = require('./routes/entrate');
const authRoutes = require('./routes/auth');
const budgetSettingsRoutes = require('./routes/budgetSettings');

dotenv.config();

const app = express();

// CORS configuration
const corsOptions = {
  origin: ['http://localhost:3000', 'https://budget-app-three-gules.vercel.app'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());

// Routes
app.use('/api/spese', speseRoutes);
app.use('/api/entrate', entrateRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/budget-settings', budgetSettingsRoutes);

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB:', err));

const port = process.env.PORT || 5000;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
}); 