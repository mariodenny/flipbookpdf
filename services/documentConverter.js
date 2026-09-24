/**
 * Document Converter Service
 *
 * Converts DOC, DOCX, TXT, MD, RTF files into PDF.
 * PDF files pass through unchanged.
 *
 * Vercel-compatible: uses only pure Node.js packages, no system dependencies.
 *
 * Conversion quality:
 * - DOCX: preserves headings, bold, italic, lists (via mammoth → HTML → pdfkit)
 * - DOC:  text extraction only (via word-extractor → pdfkit)
 * - TXT:  plain text with paragraph spacing
 * - MD:   headings, bold, italic, lists, links (via marked → HTML → pdfkit)
 * - RTF:  text extraction with basic paragraph handling
 */

const PDFDocument = require('pdfkit');
const mammoth = require('mammoth');
const { marked } = require('marked');
const { Parser } = require('htmlparser2');
const WordExtractor = require('word-extractor');

// ── Supported types ─────────────────────────────────────────

const SUPPORTED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
  'application/rtf',
  'text/rtf',
];

const SUPPORTED_EXTS = ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf'];

function isSupportedFile(mimetype, filename) {
  const ext = getExtension(filename);
  return SUPPORTED_EXTS.includes(ext) || SUPPORTED_MIMES.includes(mimetype);
}

function getExtension(filename) {
  return '.' + (filename || '').split('.').pop().toLowerCase();
}

function getFileType(filename) {
  return (filename || '').split('.').pop().toLowerCase();
}

// ── Main converter ──────────────────────────────────────────

/**
 * Convert a document buffer to PDF.
 * @param {Buffer} buffer - The uploaded file buffer
 * @param {string} originalFilename - Original filename (for extension detection)
 * @param {string} mimeType - MIME type of the uploaded file
 * @returns {Promise<{ pdfBuffer: Buffer, converted: boolean, fileType: string }>}
 */
async function convertToPdf(buffer, originalFilename, mimeType) {
  const ext = getExtension(originalFilename);
  const fileType = getFileType(originalFilename);

  // PDF — pass through, no conversion needed
  if (ext === '.pdf') {
    // Validate PDF header
    const header = buffer.slice(0, 5).toString('ascii');
    if (header !== '%PDF-') {
      throw new Error('The uploaded file is not a valid PDF.');
    }
    return { pdfBuffer: buffer, converted: false, fileType: 'pdf' };
  }

  let html = '';
  let plainText = '';

  // DOCX — convert to HTML with mammoth (preserves formatting)
  if (ext === '.docx') {
    try {
      const result = await mammoth.convertToHtml({ buffer });
      html = result.value;
      if (!html || !html.trim()) {
        throw new Error('empty');
      }
    } catch (err) {
      if (err.message === 'empty') {
        throw new Error('The document appears to be empty.');
      }
      console.error('DOCX conversion error:', err);
      throw new Error('Unable to convert this document to PDF. The file may be corrupted.');
    }
  }

  // DOC — extract text with word-extractor
  else if (ext === '.doc') {
    try {
      const extractor = new WordExtractor();
      const doc = await extractor.extract(buffer);
      plainText = doc.getBody();
      if (!plainText || !plainText.trim()) {
        throw new Error('empty');
      }
    } catch (err) {
      if (err.message === 'empty') {
        throw new Error('The document appears to be empty.');
      }
      console.error('DOC conversion error:', err);
      throw new Error('Unable to convert this document to PDF. The file may be corrupted.');
    }
  }

  // Markdown — convert to HTML with marked
  else if (ext === '.md') {
    try {
      const text = buffer.toString('utf-8');
      if (!text.trim()) {
        throw new Error('The document appears to be empty.');
      }
      html = typeof marked.parse === 'function' ? marked.parse(text) : (typeof marked === 'function' ? marked(text) : String(text));
    } catch (err) {
      if (err.message && err.message.includes('empty')) throw err;
      console.error('Markdown conversion error:', err);
      throw new Error('Unable to convert this document to PDF.');
    }
  }

  // TXT — plain text
  else if (ext === '.txt') {
    plainText = buffer.toString('utf-8');
    if (!plainText.trim()) {
      throw new Error('The document appears to be empty.');
    }
  }

  // RTF — strip formatting, extract text
  else if (ext === '.rtf') {
    try {
      plainText = stripRtf(buffer.toString('utf-8'));
      if (!plainText.trim()) {
        throw new Error('The document appears to be empty.');
      }
    } catch (err) {
      if (err.message.includes('empty')) throw err;
      console.error('RTF conversion error:', err);
      throw new Error('Unable to convert this document to PDF.');
    }
  }

  else {
    throw new Error('Unsupported document type.');
  }

  // Generate PDF from extracted content
  let pdfBuffer;
  try {
    if (html) {
      pdfBuffer = await generatePdfFromHtml(html);
    } else {
      pdfBuffer = await generatePdfFromText(plainText);
    }
  } catch (err) {
    console.error('PDF generation error:', err);
    throw new Error('Unable to convert this document to PDF.');
  }

  return { pdfBuffer, converted: true, fileType };
}

// ── PDF from plain text ─────────────────────────────────────

function generatePdfFromText(text) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.font('Helvetica').fontSize(12);

      // Split into paragraphs (double newline) and render
      const paragraphs = text.split(/\n{2,}/);
      paragraphs.forEach((para, i) => {
        if (i > 0) doc.moveDown(0.5);
        // Preserve single line breaks within paragraphs
        const lines = para.split('\n');
        lines.forEach((line) => {
          doc.text(line.trimEnd());
        });
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ── PDF from HTML ───────────────────────────────────────────

function generatePdfFromHtml(html) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      renderHtmlToPdf(doc, html);

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Render HTML to a PDFKit document.
 * Handles: h1-h6, p, strong/b, em/i, ul, ol, li, br, blockquote, pre/code, a
 */
function renderHtmlToPdf(doc, html) {
  const HEADING_SIZES = { h1: 24, h2: 20, h3: 17, h4: 14, h5: 12, h6: 11 };
  const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'div', 'blockquote', 'pre', 'tr']);

  let bold = 0;        // nesting counter
  let italic = 0;      // nesting counter
  let monospace = 0;   // nesting counter
  let blockType = 'p';
  let segments = [];   // { text, bold, italic, mono }
  let listStack = [];  // [{ type: 'ul'|'ol', counter: 0 }]
  let firstBlock = true;

  function getFont(b, i, m) {
    if (m) return 'Courier';
    if (b && i) return 'Helvetica-BoldOblique';
    if (b) return 'Helvetica-Bold';
    if (i) return 'Helvetica-Oblique';
    return 'Helvetica';
  }

  function flushBlock() {
    // Filter out empty segments
    const nonEmpty = segments.filter((s) => s.text.length > 0);
    if (nonEmpty.length === 0) {
      segments = [];
      return;
    }

    const isHeading = blockType in HEADING_SIZES;
    const fontSize = HEADING_SIZES[blockType] || 12;

    // Spacing before the block
    if (!firstBlock) {
      doc.moveDown(isHeading ? 0.6 : 0.3);
    }
    firstBlock = false;

    // Indent for list items
    const indent = listStack.length > 0 ? 20 * listStack.length : 0;

    // Render each segment with continued text
    for (let i = 0; i < nonEmpty.length; i++) {
      const seg = nonEmpty[i];
      const isLast = i === nonEmpty.length - 1;
      const font = getFont(seg.bold, seg.italic, seg.mono);

      doc.font(font).fontSize(fontSize);

      const options = {
        continued: !isLast,
        indent: i === 0 ? indent : 0,
      };

      doc.text(seg.text, options);
    }

    segments = [];
  }

  const parser = new Parser(
    {
      onopentag(name) {
        if (BLOCK_TAGS.has(name)) {
          flushBlock();
          blockType = name;

          // List item prefix
          if (name === 'li' && listStack.length > 0) {
            const list = listStack[listStack.length - 1];
            list.counter++;
            const prefix = list.type === 'ul' ? '•  ' : `${list.counter}.  `;
            segments.push({ text: prefix, bold: false, italic: false, mono: false });
          }
        } else if (name === 'strong' || name === 'b') {
          bold++;
        } else if (name === 'em' || name === 'i') {
          italic++;
        } else if (name === 'code' || name === 'pre') {
          monospace++;
        } else if (name === 'ul') {
          flushBlock();
          listStack.push({ type: 'ul', counter: 0 });
        } else if (name === 'ol') {
          flushBlock();
          listStack.push({ type: 'ol', counter: 0 });
        } else if (name === 'br') {
          segments.push({ text: '\n', bold: bold > 0, italic: italic > 0, mono: monospace > 0 });
        }
      },

      ontext(text) {
        // Collapse whitespace for non-preformatted text
        let processed = text;
        if (monospace === 0) {
          processed = text.replace(/\s+/g, ' ');
        }
        if (processed) {
          segments.push({
            text: processed,
            bold: bold > 0,
            italic: italic > 0,
            mono: monospace > 0,
          });
        }
      },

      onclosetag(name) {
        if (BLOCK_TAGS.has(name)) {
          flushBlock();
        } else if (name === 'strong' || name === 'b') {
          bold = Math.max(0, bold - 1);
        } else if (name === 'em' || name === 'i') {
          italic = Math.max(0, italic - 1);
        } else if (name === 'code' || name === 'pre') {
          monospace = Math.max(0, monospace - 1);
        } else if (name === 'ul' || name === 'ol') {
          flushBlock();
          listStack.pop();
        }
      },
    },
    { decodeEntities: true }
  );

  parser.write(html);
  parser.end();
  flushBlock(); // flush any remaining content
}

// ── RTF stripper ────────────────────────────────────────────

/**
 * Strip RTF control words and extract plain text.
 * Handles: paragraph breaks, escaped characters, hex chars, nested groups.
 */
function stripRtf(rtf) {
  if (!rtf) return '';

  const result = [];
  let i = 0;
  let depth = 0;
  const len = rtf.length;

  while (i < len) {
    const ch = rtf[i];

    if (ch === '{') { depth++; i++; continue; }
    if (ch === '}') { depth--; i++; continue; }
    // Skip content inside nested groups (font tables, style defs, etc.)
    if (depth > 1) { i++; continue; }

    if (ch === '\\') {
      i++;
      if (i >= len) break;
      const next = rtf[i];

      // Escaped literal characters
      if (next === '\\' || next === '{' || next === '}') {
        result.push(next);
        i++;
        continue;
      }

      // Hex character: \'XX
      if (next === "'") {
        const hex = rtf.substring(i + 1, i + 3);
        if (hex.length === 2) {
          result.push(String.fromCharCode(parseInt(hex, 16)));
        }
        i += 3;
        continue;
      }

      // Control word: \wordN (optional trailing space delimiter)
      let word = '';
      while (i < len && /[a-zA-Z]/.test(rtf[i])) {
        word += rtf[i];
        i++;
      }
      // Skip numeric parameter
      while (i < len && /[\d-]/.test(rtf[i])) i++;
      // Skip single trailing space delimiter
      if (i < len && rtf[i] === ' ') i++;

      // Convert known control words to text
      if (word === 'par' || word === 'pard') result.push('\n');
      else if (word === 'line') result.push('\n');
      else if (word === 'tab') result.push('\t');

      continue;
    }

    result.push(ch);
    i++;
  }

  return result.join('').replace(/\n{3,}/g, '\n\n').trim();
}

// ── Exports ─────────────────────────────────────────────────

module.exports = {
  convertToPdf,
  isSupportedFile,
  getFileType,
  getExtension,
  SUPPORTED_MIMES,
  SUPPORTED_EXTS,
};
