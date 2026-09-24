require('dotenv').config();

const express = require('express');
const path = require('path');
const { initDB } = require('./db/turso');

const app = express();

// Parse JSON bodies
app.use(express.json());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Initialize database once (lazy, on first request)
let dbReady = false;
app.use(async (_req, _res, next) => {
  if (!dbReady) {
    try {
      await initDB();
      dbReady = true;
      console.log('Database initialized.');
    } catch (err) {
      console.error('Failed to initialize database:', err);
      return next(err);
    }
  }
  next();
});

// Routes
app.use('/api', require('./routes/api'));
app.use('/books', require('./routes/books'));
app.use('/book', require('./routes/books'));

// Start server only in local dev (not on Vercel)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

// Export for Vercel
module.exports = app;
