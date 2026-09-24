const express = require('express');
const path = require('path');
const fs = require('fs');
const { getBookBySlug } = require('../db/turso');

const router = express.Router();

/**
 * GET /books — Serve the books list page
 */
router.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'books.html'));
});

/**
 * GET /book/:slug — Serve the flipbook viewer with book data injected
 */
router.get('/:slug', async (req, res) => {
  try {
    const book = await getBookBySlug(req.params.slug);

    if (!book) {
      return res.status(404).send(get404Page());
    }

    // Read viewer.html and inject book data
    const viewerPath = path.join(__dirname, '..', 'public', 'viewer.html');
    let html = fs.readFileSync(viewerPath, 'utf-8');

    // Inject book data as a script tag before </head>
    const bookData = JSON.stringify({
      id: book.id,
      title: book.title,
      slug: book.slug,
      pdfUrl: book.pdf_url,
      originalFilename: book.original_filename,
    });

    html = html.replace(
      '</head>',
      `<script>window.__BOOK_DATA__ = ${bookData};</script>\n</head>`
    );

    // Update page title
    html = html.replace(
      '<title>PDF Flipbook</title>',
      `<title>${escapeHtml(book.title)} — PDF Flipbook</title>`
    );

    res.send(html);
  } catch (error) {
    console.error('Viewer error:', error);
    res.status(500).send(get404Page('Unable to load the book.'));
  }
});

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function get404Page(message = 'Book not found.') {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Found — PDF Flipbook</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: #0f0f13;
      color: #e4e4e7;
    }
    .error-card {
      text-align: center;
      padding: 3rem 2rem;
    }
    .error-card .code {
      font-size: 5rem;
      font-weight: 800;
      background: linear-gradient(135deg, #6366f1, #a78bfa);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1;
    }
    .error-card p {
      margin-top: 1rem;
      font-size: 1.15rem;
      color: #a1a1aa;
    }
    .error-card a {
      display: inline-block;
      margin-top: 2rem;
      padding: 0.7rem 1.8rem;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      transition: opacity 0.2s;
    }
    .error-card a:hover { opacity: 0.85; }
  </style>
</head>
<body>
  <div class="error-card">
    <div class="code">404</div>
    <p>${escapeHtml(message)}</p>
    <a href="/">← Back to Home</a>
  </div>
</body>
</html>`;
}

module.exports = router;
