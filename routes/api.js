const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const slugify = require('slugify');
const { uploadPDF, deletePDF } = require('../services/cloudinary');
const { insertBook, getAllBooks, getBookById, deleteBookById } = require('../db/turso');
const { convertToPdf, SUPPORTED_MIMES, SUPPORTED_EXTS, getExtension } = require('../services/documentConverter');

const router = express.Router();

// Multer — memory storage (Vercel-compatible, no local filesystem)
const maxSize = (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 50) * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSize },
  fileFilter: (_req, file, cb) => {
    // Validate MIME type and extension
    const ext = getExtension(file.originalname);

    const mimeOk = SUPPORTED_MIMES.includes(file.mimetype);
    const extOk = SUPPORTED_EXTS.includes(ext);

    if (!mimeOk && !extOk) {
      return cb(new Error('Unsupported document type. Supported: PDF, DOC, DOCX, TXT, MD, RTF.'));
    }
    cb(null, true);
  },
});

/**
 * POST /api/books — Upload a new document (PDF or convertible document)
 */
router.post('/books', (req, res, next) => {
  upload.single('file')(req, res, async (err) => {
    try {
      // Handle multer errors
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: `The file is too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 50}MB.`,
          });
        }
        return res.status(400).json({ success: false, error: err.message });
      }

      // Validate title
      const title = (req.body.title || '').trim();
      if (!title) {
        return res.status(400).json({ success: false, error: 'Please enter a book title.' });
      }
      if (title.length > 200) {
        return res.status(400).json({ success: false, error: 'Title is too long (max 200 characters).' });
      }

      // Validate file
      if (!req.file) {
        return res.status(400).json({ success: false, error: 'Please upload a document file.' });
      }

      // Convert to PDF if necessary
      let pdfBuffer;
      let fileType;
      try {
        const result = await convertToPdf(req.file.buffer, req.file.originalname, req.file.mimetype);
        pdfBuffer = result.pdfBuffer;
        fileType = result.fileType;
      } catch (convErr) {
        return res.status(400).json({ success: false, error: convErr.message });
      }

      // Generate slug
      const shortId = crypto.randomBytes(3).toString('hex'); // 6 hex chars
      const baseSlug = slugify(title, { lower: true, strict: true });
      const slug = `${baseSlug}-${shortId}`;

      // Generate a unique Cloudinary public ID
      const cloudinaryPublicId = `${baseSlug}-${shortId}`;

      // Upload the final PDF to Cloudinary
      let cloudResult;
      try {
        cloudResult = await uploadPDF(pdfBuffer, cloudinaryPublicId);
      } catch (uploadErr) {
        console.error('Cloudinary upload error:', uploadErr);
        return res.status(500).json({ success: false, error: 'Upload failed. Please try again.' });
      }

      // Save to Turso
      let bookId;
      try {
        bookId = await insertBook({
          title,
          slug,
          pdfUrl: cloudResult.secure_url,
          cloudinaryPublicId: cloudResult.public_id,
          originalFilename: req.file.originalname,
          originalFileType: fileType,
        });
      } catch (dbErr) {
        console.error('Database insert error:', dbErr);
        // Attempt to clean up the Cloudinary upload
        try { await deletePDF(cloudResult.public_id); } catch (_) { /* best effort */ }
        return res.status(500).json({ success: false, error: 'Failed to save book. Please try again.' });
      }

      res.json({
        success: true,
        book: {
          id: Number(bookId),
          title,
          slug,
          url: `/book/${slug}`,
        },
      });
    } catch (error) {
      console.error('Unexpected error:', error);
      res.status(500).json({ success: false, error: 'An unexpected error occurred.' });
    }
  });
});

/**
 * GET /api/books/list — Return all books as JSON
 */
router.get('/books/list', async (_req, res) => {
  try {
    const books = await getAllBooks();
    res.json({ success: true, books });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({ success: false, error: 'Failed to load books.' });
  }
});

/**
 * DELETE /api/books/:id — Delete a book
 */
router.delete('/books/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ success: false, error: 'Invalid book ID.' });
    }

    const book = await getBookById(id);
    if (!book) {
      return res.status(404).json({ success: false, error: 'Book not found.' });
    }

    // Delete from Cloudinary first
    try {
      await deletePDF(book.cloudinary_public_id);
    } catch (cloudErr) {
      console.error('Cloudinary delete error:', cloudErr);
      return res.status(500).json({
        success: false,
        error: 'Failed to delete PDF from storage. Book was NOT deleted.',
      });
    }

    // Delete from database
    await deleteBookById(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete book.' });
  }
});

module.exports = router;
