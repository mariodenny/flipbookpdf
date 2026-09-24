(() => {
  const container = document.getElementById('books-container');
  const alertEl = document.getElementById('alert');

  function showAlert(message, type = 'error') {
    alertEl.textContent = message;
    alertEl.className = `alert alert-${type} show`;
  }

  async function loadBooks() {
    try {
      const res = await fetch('/api/books/list');
      const data = await res.json();

      if (!data.success) {
        container.innerHTML = '';
        showAlert('Failed to load books.');
        return;
      }

      if (!data.books.length) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="icon">📚</div>
            <p>No books uploaded yet.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = `<div class="book-list">${data.books.map(bookCard).join('')}</div>`;

      // Attach delete handlers
      container.querySelectorAll('.btn-delete').forEach((btn) => {
        btn.addEventListener('click', () => handleDelete(btn.dataset.id, btn.dataset.title));
      });
    } catch (err) {
      console.error('Load error:', err);
      container.innerHTML = '';
      showAlert('Failed to load books.');
    }
  }

  function bookCard(book) {
    const fileType = (book.original_file_type || (book.original_filename ? book.original_filename.split('.').pop() : 'pdf')).toUpperCase();
    return `
      <div class="book-item">
        <div class="book-info">
          <h3>${escapeHtml(book.title)} <span class="format-badge" style="font-size:0.7rem; padding:0.15rem 0.45rem; border-radius:4px; background:rgba(99,102,241,0.15); color:var(--primary, #6366f1); font-weight:600; text-transform:uppercase; vertical-align:middle; margin-left:0.3rem;">${escapeHtml(fileType)}</span></h3>
          <div class="slug">${escapeHtml(book.slug)}</div>
        </div>
        <div class="book-actions">
          <a href="/book/${escapeHtml(book.slug)}" class="btn btn-secondary btn-sm">Open</a>
          <button class="btn btn-danger btn-sm btn-delete" data-id="${book.id}" data-title="${escapeAttr(book.title)}">Delete</button>
        </div>
      </div>
    `;
  }

  async function handleDelete(id, title) {
    if (!confirm(`Delete "${title}"?\n\nThis will permanently remove the book and its PDF.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/books/${id}`, { method: 'DELETE' });
      const data = await res.json();

      if (!data.success) {
        showAlert(data.error || 'Failed to delete book.');
        return;
      }

      showAlert('Book deleted.', 'success');
      loadBooks();
    } catch (err) {
      console.error('Delete error:', err);
      showAlert('Failed to delete book.');
    }
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  loadBooks();
})();
