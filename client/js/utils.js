// ✅ COMPLETE client/js/utils.js

const API_BASE = '/api'; // Ensure this matches your server prefix

/**
 * Wrapper around fetch() that handles headers and errors automatically.
 */
async function apiFetch(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const response = await fetch(url, config);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.message || 'Something went wrong');
    error.status = response.status;
    throw error;
  }

  return data;
}

/**
 * Simple Toast Notification
 */
function showToast(message, type = 'success') {
  // Create toast container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed; bottom: 20px; right: 20px; z-index: 9999;
    `;
    document.body.appendChild(container);
  }

  // Create toast element
  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.cssText = `
    background: ${type === 'success' ? '#4CAF50' : '#F44336'};
    color: white; padding: 12px 24px; margin-top: 10px;
    border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    font-family: sans-serif; opacity: 0; transition: opacity 0.3s;
  `;

  container.appendChild(toast);

  // Fade in
  requestAnimationFrame(() => { toast.style.opacity = '1'; });

  // Remove after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/**
 * Setup Real-time Input Validation
 */
function setupInlineValidation(input, validateFn) {
  if (!input) return;
  
  const errorMsg = document.createElement('small');
  errorMsg.style.color = 'red';
  errorMsg.style.display = 'none';
  input.parentNode.appendChild(errorMsg);

  input.addEventListener('input', () => {
    const error = validateFn(input.value);
    if (error) {
      errorMsg.textContent = error;
      errorMsg.style.display = 'block';
      input.style.borderColor = 'red';
    } else {
      errorMsg.style.display = 'none';
      input.style.borderColor = '#ccc'; // Reset to default
    }
  });
}

/**
 * Loading State for Buttons
 */
function setBtnLoading(btn, isLoading) {
  if (isLoading) {
    btn.dataset.originalText = btn.textContent;
    btn.textContent = 'Loading...';
    btn.disabled = true;
  } else {
    btn.textContent = btn.dataset.originalText || 'Submit';
    btn.disabled = false;
  }
}

// Make globally available
window.apiFetch = apiFetch;
window.showToast = showToast;
window.setupInlineValidation = setupInlineValidation;
window.setBtnLoading = setBtnLoading;