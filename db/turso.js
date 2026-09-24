const { createClient } = require('@libsql/client');

let db;

function getDB() {
  if (!db) {
    db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return db;
}

async function initDB() {
  const client = getDB();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      pdf_url TEXT NOT NULL,
      cloudinary_public_id TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      original_file_type TEXT DEFAULT 'pdf',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Safely migrate existing tables if original_file_type column does not exist yet
  try {
    await client.execute(`ALTER TABLE books ADD COLUMN original_file_type TEXT DEFAULT 'pdf'`);
  } catch (_) {
    // Column already exists or table freshly created
  }
}

async function insertBook({ title, slug, pdfUrl, cloudinaryPublicId, originalFilename, originalFileType = 'pdf' }) {
  const client = getDB();
  try {
    const result = await client.execute({
      sql: `INSERT INTO books (title, slug, pdf_url, cloudinary_public_id, original_filename, original_file_type)
            VALUES (?, ?, ?, ?, ?, ?)`,
      args: [title, slug, pdfUrl, cloudinaryPublicId, originalFilename, originalFileType],
    });
    return result.lastInsertRowid;
  } catch (err) {
    // Graceful fallback if database schema is without original_file_type
    const result = await client.execute({
      sql: `INSERT INTO books (title, slug, pdf_url, cloudinary_public_id, original_filename)
            VALUES (?, ?, ?, ?, ?)`,
      args: [title, slug, pdfUrl, cloudinaryPublicId, originalFilename],
    });
    return result.lastInsertRowid;
  }
}

async function getBookBySlug(slug) {
  const client = getDB();
  const result = await client.execute({
    sql: 'SELECT * FROM books WHERE slug = ?',
    args: [slug],
  });
  return result.rows[0] || null;
}

async function getBookById(id) {
  const client = getDB();
  const result = await client.execute({
    sql: 'SELECT * FROM books WHERE id = ?',
    args: [id],
  });
  return result.rows[0] || null;
}

async function getAllBooks() {
  const client = getDB();
  const result = await client.execute('SELECT * FROM books ORDER BY created_at DESC');
  return result.rows;
}

async function deleteBookById(id) {
  const client = getDB();
  await client.execute({
    sql: 'DELETE FROM books WHERE id = ?',
    args: [id],
  });
}

module.exports = {
  initDB,
  insertBook,
  getBookBySlug,
  getBookById,
  getAllBooks,
  deleteBookById,
};
