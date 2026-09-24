(() => {
  const form = document.getElementById('upload-form');
  const titleInput = document.getElementById('title');
  const fileInput = document.getElementById('file');
  const submitBtn = document.getElementById('submit-btn');
  const alert = document.getElementById('alert');

  const SUPPORTED_EXTS = ['.pdf', '.doc', '.docx', '.txt', '.md', '.rtf'];
  let loadingInterval = null;

  function showAlert(message, type = 'error') {
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
  }

  function hideAlert() {
    alert.className = 'alert';
  }

  function updateStatus(text) {
    submitBtn.innerHTML = `<span class="spinner"></span> ${text}`;
  }

  function setLoading(loading, isPdf = false) {
    if (loadingInterval) {
      clearInterval(loadingInterval);
      loadingInterval = null;
    }

    if (loading) {
      submitBtn.disabled = true;
      if (isPdf) {
        updateStatus('Uploading PDF…');
        // Transition to generating flipbook after a moment
        loadingInterval = setTimeout(() => {
          updateStatus('Generating flipbook…');
        }, 1500);
      } else {
        updateStatus('Uploading document…');
        // Progressive feedback for conversion
        const step1 = setTimeout(() => {
          updateStatus('Converting document to PDF…');
        }, 1200);
        const step2 = setTimeout(() => {
          updateStatus('Generating flipbook…');
        }, 3000);
        loadingInterval = {
          clear: () => {
            clearTimeout(step1);
            clearTimeout(step2);
          },
        };
      }
    } else {
      if (loadingInterval && typeof loadingInterval.clear === 'function') {
        loadingInterval.clear();
      }
      submitBtn.disabled = false;
      submitBtn.textContent = 'Generate Flipbook';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    // Client-side validation
    const title = titleInput.value.trim();
    if (!title) {
      showAlert('Please enter a book title.');
      titleInput.focus();
      return;
    }

    if (!fileInput.files.length) {
      showAlert('Please select a document file to upload.');
      return;
    }

    const file = fileInput.files[0];
    const ext = '.' + file.name.split('.').pop().toLowerCase();

    // Check extension
    if (!SUPPORTED_EXTS.includes(ext)) {
      showAlert('Unsupported document type. Supported: PDF, DOC, DOCX, TXT, MD, RTF.');
      return;
    }

    const isPdf = ext === '.pdf';

    // Build FormData
    const formData = new FormData();
    formData.append('title', title);
    formData.append('file', file);

    setLoading(true, isPdf);

    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        showAlert(data.error || 'Upload failed. Please try again.');
        setLoading(false);
        return;
      }

      // Redirect to the flipbook
      window.location.href = data.book.url;
    } catch (err) {
      console.error('Upload error:', err);
      showAlert('Upload failed. Please check your connection and try again.');
      setLoading(false);
    }
  });
})();
