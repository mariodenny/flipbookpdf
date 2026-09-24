// PDF Flipbook Viewer
// Loads a PDF via PDF.js, renders pages to canvases, and displays them in StPageFlip.

const PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.min.mjs';
const PDFJS_WORKER_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.7.76/pdf.worker.min.mjs';

// ── DOM References ──────────────────────────────────────────

const titleEl       = document.getElementById('book-title');
const loadingEl     = document.getElementById('viewer-loading');
const loadingText   = document.getElementById('loading-text');
const errorEl       = document.getElementById('viewer-error');
const flipbookEl    = document.getElementById('flipbook');
const controlsEl    = document.getElementById('viewer-controls');
const btnPrev       = document.getElementById('btn-prev');
const btnNext       = document.getElementById('btn-next');
const pageInfoEl    = document.getElementById('page-info');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnDownload   = document.getElementById('btn-download');
const viewerPage    = document.getElementById('viewer-page');

// ── Book data (injected by server) ──────────────────────────

const bookData = window.__BOOK_DATA__;

if (!bookData) {
  showError('Book data not found.');
}

// ── State ───────────────────────────────────────────────────

let pageFlip = null;
let totalPages = 0;

// ── Init ────────────────────────────────────────────────────

async function init() {
  if (!bookData) return;

  // Set title & download link
  titleEl.textContent = bookData.title;
  btnDownload.href = bookData.pdfUrl;
  btnDownload.download = bookData.originalFilename;

  try {
    // Dynamically import PDF.js
    loadingText.textContent = 'Loading PDF library…';
    const pdfjsLib = await import(PDFJS_CDN);
    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_CDN;

    // Load PDF document
    loadingText.textContent = 'Loading PDF…';
    const pdf = await pdfjsLib.getDocument(bookData.pdfUrl).promise;
    totalPages = pdf.numPages;

    if (totalPages === 0) {
      showError('This PDF has no pages.');
      return;
    }

    // Determine page dimensions from first page
    const firstPage = await pdf.getPage(1);
    const viewport = firstPage.getViewport({ scale: 1 });
    const pageRatio = viewport.width / viewport.height;

    // Calculate flipbook dimensions based on available space
    const dims = calcDimensions(pageRatio);

    // Render all pages into image elements
    loadingText.textContent = 'Rendering pages…';
    const pages = await renderAllPages(pdf, dims.pageWidth, dims.pageHeight);

    // Hide loading, show flipbook
    loadingEl.style.display = 'none';

    // Create page elements inside #flipbook
    pages.forEach((imgSrc, i) => {
      const div = document.createElement('div');
      div.className = 'page-canvas';
      // First and last pages are hard covers, rest are soft
      div.dataset.density = (i === 0 || i === pages.length - 1) ? 'hard' : 'soft';

      const img = document.createElement('img');
      img.src = imgSrc;
      img.alt = `Page ${i + 1}`;
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'contain';
      img.draggable = false;

      div.appendChild(img);
      flipbookEl.appendChild(div);
    });

    // Initialize StPageFlip
    const isMobile = window.innerWidth <= 768;

    pageFlip = new St.PageFlip(flipbookEl, {
      width: dims.pageWidth,
      height: dims.pageHeight,
      size: 'stretch',
      minWidth: 200,
      maxWidth: 1200,
      minHeight: 300,
      maxHeight: 1600,
      showCover: true,
      maxShadowOpacity: 0.5,
      mobileScrollSupport: false,
      useMouseEvents: true,
      swipeDistance: 30,
      startPage: 0,
      drawShadow: true,
      flippingTime: 800,
      startZIndex: 0,
      autoSize: true,
      usePortrait: isMobile,
    });

    pageFlip.loadFromHTML(flipbookEl.querySelectorAll('.page-canvas'));

    // Show controls
    controlsEl.style.display = 'flex';
    updatePageInfo();

    // Event listeners
    pageFlip.on('flip', () => updatePageInfo());

    btnPrev.addEventListener('click', () => pageFlip.flipPrev());
    btnNext.addEventListener('click', () => pageFlip.flipNext());
    btnFullscreen.addEventListener('click', toggleFullscreen);

    // Handle resize
    window.addEventListener('resize', handleResize);

  } catch (err) {
    console.error('Viewer init error:', err);
    showError('Unable to load the PDF.');
  }
}

// ── Render PDF pages to data URLs ───────────────────────────

async function renderAllPages(pdf, width, height) {
  const pages = [];
  const BATCH_SIZE = 4;
  const scale = window.devicePixelRatio || 1;

  for (let i = 1; i <= pdf.numPages; i += BATCH_SIZE) {
    const batch = [];
    for (let j = i; j < i + BATCH_SIZE && j <= pdf.numPages; j++) {
      batch.push(renderPage(pdf, j, width, height, scale));
    }
    const results = await Promise.all(batch);
    pages.push(...results);

    // Update loading text
    const done = Math.min(i + BATCH_SIZE - 1, pdf.numPages);
    loadingText.textContent = `Rendering pages… ${done} / ${pdf.numPages}`;
  }

  return pages;
}

async function renderPage(pdf, pageNum, width, height, scale) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale: 1 });

  // Scale to fit target dimensions
  const targetScale = Math.min(width / viewport.width, height / viewport.height) * scale;
  const scaledViewport = page.getViewport({ scale: targetScale });

  const canvas = document.createElement('canvas');
  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport: scaledViewport }).promise;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  page.cleanup();
  return dataUrl;
}

// ── Dimensions ──────────────────────────────────────────────

function calcDimensions(pageRatio) {
  const isMobile = window.innerWidth <= 768;
  const maxW = isMobile ? window.innerWidth - 20 : Math.min(window.innerWidth * 0.45, 600);
  const maxH = window.innerHeight - 180;

  let pageWidth = maxW;
  let pageHeight = pageWidth / pageRatio;

  if (pageHeight > maxH) {
    pageHeight = maxH;
    pageWidth = pageHeight * pageRatio;
  }

  return {
    pageWidth: Math.round(pageWidth),
    pageHeight: Math.round(pageHeight),
  };
}

// ── Page info ───────────────────────────────────────────────

function updatePageInfo() {
  if (!pageFlip) return;
  const current = pageFlip.getCurrentPageIndex() + 1;
  const total = pageFlip.getPageCount();
  pageInfoEl.textContent = `${current} / ${total}`;

  btnPrev.disabled = current <= 1;
  btnNext.disabled = current >= total;
}

// ── Fullscreen ──────────────────────────────────────────────

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    viewerPage.requestFullscreen?.() ||
    viewerPage.webkitRequestFullscreen?.() ||
    viewerPage.msRequestFullscreen?.();
  } else {
    document.exitFullscreen?.() ||
    document.webkitExitFullscreen?.() ||
    document.msExitFullscreen?.();
  }
}

document.addEventListener('fullscreenchange', () => {
  viewerPage.classList.toggle('fullscreen', !!document.fullscreenElement);
  if (pageFlip) {
    // Give the browser a tick to recalculate layout
    setTimeout(() => pageFlip.update(), 100);
  }
});

// ── Resize ──────────────────────────────────────────────────

let resizeTimeout;
function handleResize() {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    if (pageFlip) pageFlip.update();
  }, 200);
}

// ── Error helper ────────────────────────────────────────────

function showError(msg) {
  loadingEl.style.display = 'none';
  errorEl.style.display = 'block';
  if (msg) {
    errorEl.querySelector('h2').textContent = msg;
  }
}

// ── Go ──────────────────────────────────────────────────────

init();
