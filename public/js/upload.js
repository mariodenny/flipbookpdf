(() => {
  const form = document.getElementById('upload-form');
  const titleInput = document.getElementById('title');
  const fileInput = document.getElementById('file');
  const submitBtn = document.getElementById('submit-btn');
  const alert = document.getElementById('alert');

  function showAlert(message, type = 'error') {
    alert.textContent = message;
    alert.className = `alert alert-${type} show`;
  }

  function hideAlert() {
    alert.className = 'alert';
  }

  function setLoading(loading) {
    if (loading) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="spinner"></span> Uploading…';
    } else {
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
      showAlert('Please upload a PDF file.');
      return;
    }

    const file = fileInput.files[0];

    // Check extension
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showAlert('Only PDF files are allowed.');
      return;
    }

    // Check MIME type (some browsers may report differently)
    if (file.type && file.type !== 'application/pdf') {
      showAlert('Only PDF files are allowed.');
      return;
    }

    // Build FormData
    const formData = new FormData();
    formData.append('title', title);
    formData.append('file', file);

    setLoading(true);

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
