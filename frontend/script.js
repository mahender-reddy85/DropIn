const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3001' : 'https://dropin-dn6i.onrender.com';

console.log('Script loaded and DOMContentLoaded event listener attached');

document.addEventListener('DOMContentLoaded', function () {
  console.log('DOMContentLoaded event fired');

  // Cache all DOM elements with proper error handling
  const elements = {
    sendTab: document.getElementById('sendTab'),
    receiveTab: document.getElementById('receiveTab'),
    sendContent: document.getElementById('sendContent'),
    receiveContent: document.getElementById('receiveContent'),
    dropArea: document.getElementById('dropArea'),
    browseBtn: document.querySelector('.browse-link'),
    fileInput: document.getElementById('fileInput'),
    fileList: document.getElementById('fileList'),
    clearBtn: document.getElementById('clearBtn'),
    generateCodeBtn: document.getElementById('generateCodeBtn'),
    qrCodeContainer: document.getElementById('qrCodeContainer'),
    receiveInput: document.getElementById('receiveInput'),
    scanQrBtn: document.getElementById('scanQrBtn'),
    receiveBtn: document.getElementById('receiveBtn'),
    codeModal: document.getElementById('codeModal'),
    codeDisplay: document.getElementById('codeDisplay'),
    closeCodeModal: document.getElementById('closeCodeModal'),
    closeScannerBtn: document.getElementById('closeScannerBtn'),
    qrModal: document.getElementById('qrModal'),
    qrVideo: document.getElementById('qrVideo'),
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    shareBtn: document.getElementById('shareBtn'),
    emailBtn: document.getElementById('emailBtn'),
    themeToggleBtn: document.getElementById('themeToggle'),
    downloadPreview: document.getElementById('downloadPreview'),
    downloadFileList: document.getElementById('downloadFileList'),
    extendBtn: document.getElementById('extendBtn'),
    deleteBtn: document.getElementById('deleteBtn'),
    downloadStats: document.getElementById('downloadStats')
  };

  // State management
  let selectedFiles = [];
  let currentCode = null;
  let qrScanner = null;

  // Dark mode toggle
  function initDarkModeToggle() {
    if (!elements.themeToggleBtn) {
      console.warn('Theme toggle button not found');
      return;
    }

    // Load saved theme from localStorage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
      updateThemeIcon(savedTheme);
    }

    elements.themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      updateThemeIcon(newTheme);
    });
  }

  function updateThemeIcon(theme) {
    if (!elements.themeToggleBtn) return;
    const icon = elements.themeToggleBtn.querySelector('i');
    if (!icon) return;
    if (theme === 'dark') {
      icon.classList.remove('fa-moon');
      icon.classList.add('fa-sun');
    } else {
      icon.classList.remove('fa-sun');
      icon.classList.add('fa-moon');
    }
  }


  // Tab switching functionality
  function initTabs() {
    if (!elements.sendTab || !elements.receiveTab || !elements.sendContent || !elements.receiveContent) {
      console.error('Tab elements not found');
      return;
    }
    elements.sendTab.addEventListener('click', () => switchTab('send'));
    elements.receiveTab.addEventListener('click', () => switchTab('receive'));
  }

  function switchTab(activeTab) {
    const tabs = [
      { tab: elements.sendTab, content: elements.sendContent },
      { tab: elements.receiveTab, content: elements.receiveContent }
    ];

    tabs.forEach(({ tab, content }) => {
      if (tab && content) {
        tab.classList.remove('active');
        content.style.display = 'none';
      }
    });

    const active = tabs.find(({ tab }) =>
      activeTab === 'send' ? tab === elements.sendTab : tab === elements.receiveTab
    );

    if (active && active.tab && active.content) {
      active.tab.classList.add('active');
      active.content.style.display = 'block';
    }
  }

  // File handling functionality
  function initFileHandling() {
    if (!elements.dropArea || !elements.fileInput || !elements.fileList) {
      console.error('File handling elements not found');
      return;
    }

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      elements.dropArea.addEventListener(eventName, preventDefaults, false);
    });

    ['dragenter', 'dragover'].forEach(eventName => {
      elements.dropArea.addEventListener(eventName, highlight);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      elements.dropArea.addEventListener(eventName, unhighlight);
    });

    elements.dropArea.addEventListener('drop', handleDrop);

    if (elements.browseBtn) {
      elements.browseBtn.addEventListener('click', () => {
        elements.fileInput.click();
      });
    }

    elements.fileInput.addEventListener('change', handleFiles);
    elements.clearBtn.addEventListener('click', clearFiles);
  }

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  function highlight() {
    elements.dropArea.classList.add('highlight');
  }

  function unhighlight() {
    elements.dropArea.classList.remove('highlight');
  }

  function handleDrop(e) {
    const files = e.dataTransfer.files;
    handleFiles({ target: { files } });
  }

  function handleFiles(e) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      selectedFiles = [...selectedFiles, ...files];
      displayFiles();
    }
  }

  function displayFiles() {
    if (!elements.fileList) return;

    elements.fileList.innerHTML = '';

    selectedFiles.forEach((file, index) => {
      const fileItem = createFileItem(file, index);
      elements.fileList.appendChild(fileItem);
    });

    updateClearButton();
    updateGenerateButton();
  }

  function createFileItem(file, index) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';

    const fileSize = formatFileSize(file.size);
    const fileIcon = getFileIcon(file.type);
    const safeName = escapeHtml(file.name);

    fileItem.innerHTML = `
      <div class="file-info">
        <span class="file-icon">${fileIcon}</span>
        <span class="file-name">${safeName}</span>
        <span class="file-size">${fileSize}</span>
      </div>
      <button class="remove-file" data-index="${index}" aria-label="Remove ${safeName}">
        <i class="fas fa-times"></i>
      </button>
    `;

    const removeBtn = fileItem.querySelector('.remove-file');
    removeBtn.addEventListener('click', () => removeFile(index));

    return fileItem;
  }

  function removeFile(index) {
    selectedFiles.splice(index, 1);
    displayFiles();
  }

  function clearFiles() {
    selectedFiles = [];
    displayFiles();
  }

  function updateClearButton() {
    if (elements.clearBtn) {
      elements.clearBtn.style.display = selectedFiles.length > 0 ? 'block' : 'none';
    }
  }

  function updateGenerateButton() {
    if (elements.generateCodeBtn) {
      elements.generateCodeBtn.disabled = selectedFiles.length === 0;
    }
  }

  // Code generation functionality
  function initCodeGeneration() {
    if (!elements.generateCodeBtn || !elements.codeModal || !elements.codeDisplay) {
      console.error('Code generation elements not found');
      return;
    }

    elements.generateCodeBtn.addEventListener('click', generateCode);
    if (elements.closeCodeModal) {
      elements.closeCodeModal.addEventListener('click', closeCodeModal);
    }
  }

  async function generateCode() {
    if (selectedFiles.length === 0) {
      showToast('Please select files first');
      return;
    }

    showToast('Uploading files...');

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });
    
    const pwInput = document.getElementById('uploadPassword');
    if (pwInput && pwInput.value.trim().length > 0) {
      formData.append('password', pwInput.value.trim());
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        let errMsg = 'Upload failed';
        try {
          const errData = await response.json();
          errMsg = errData.error || errMsg;
        } catch (e) {}
        throw new Error(errMsg);
      }

      const data = await response.json();
      currentCode = data.code;

      if (elements.codeDisplay) {
        elements.codeDisplay.textContent = currentCode;
      }

      // Generate and display QR code
      if (elements.qrCodeContainer) {
        elements.qrCodeContainer.innerHTML = '';
        const fileUrl = window.location.origin + '/file/' + currentCode;
        new QRCode(elements.qrCodeContainer, {
          text: fileUrl,
          width: 128,
          height: 128,
          colorDark: '#000000',
          colorLight: '#ffffff',
          correctLevel: QRCode.CorrectLevel.H
        });
      }

      if (elements.codeModal) {
        elements.codeModal.style.display = 'block';
      }

      showToast('Files uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      showToast('Failed to upload files. Please try again.', true);
    }
  }



  function closeCodeModal() {
    if (elements.codeModal) {
      elements.codeModal.style.display = 'none';
    }
  }

  // Receive functionality
  function initReceive() {
    if (!elements.receiveBtn || !elements.receiveInput) {
      console.error('Receive elements not found');
      return;
    }

    elements.receiveBtn.addEventListener('click', receiveFiles);
    if (elements.scanQrBtn) {
      elements.scanQrBtn.addEventListener('click', openQrScanner);
    }
  }

  async function receiveFiles() {
    const code = elements.receiveInput ? elements.receiveInput.value.trim() : '';

    if (!code) {
      showToast('Please enter a code');
      return;
    }

    showToast('Fetching files...');

    try {
      const pwInput = document.getElementById('receivePassword');
      const reqBody = (pwInput && pwInput.value.trim()) ? { password: pwInput.value.trim() } : {};
      
      const response = await fetch(`${API_BASE_URL}/api/info/${code}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(reqBody)
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Code not found or expired');
        } else if (response.status === 410) {
          throw new Error('Files expired');
        } else if (response.status === 401) {
          // Password required or wrong — highlight the password field
          const pwContainer = document.getElementById('receivePasswordContainer');
          const pwInput = document.getElementById('receivePassword');
          if (pwContainer) pwContainer.style.display = 'block';
          if (pwInput) {
            pwInput.style.border = '2px solid var(--error-color)';
            pwInput.placeholder = 'Enter password to unlock this transfer';
            pwInput.focus();
          }
          const errData = await response.json().catch(() => ({}));
          const msg = errData.error === 'Incorrect password'
            ? '❌ Wrong password — try again'
            : '🔒 This transfer is password protected — enter the password above';
          showToast(msg, true);
          return; // Don't throw, just stop here
        } else {
          throw new Error('Failed to fetch files');
        }
      }

      const data = await response.json();
      
      // Reset password field styling on success
      const pwInput2 = document.getElementById('receivePassword');
      if (pwInput2) pwInput2.style.border = '';

      if (elements.downloadStats && typeof data.downloadsCount !== 'undefined') {
        elements.downloadStats.textContent = `(Downloads: ${data.downloadsCount})`;
      }

      displayDownloadFiles(data.files, code);
      showToast('Files ready for download!');
    } catch (error) {
      console.error('Receive error:', error);
      showToast(error.message, true);
    }
  }

  function displayDownloadFiles(files, code) {
    if (!elements.downloadFileList || !elements.downloadPreview) return;

    elements.downloadFileList.innerHTML = '';

    // Create shared preview tooltip
    let previewEl = document.getElementById('filePreviewTooltip');
    if (!previewEl) {
      previewEl = document.createElement('div');
      previewEl.id = 'filePreviewTooltip';
      previewEl.className = 'file-preview-tooltip';
      document.body.appendChild(previewEl);
    }

    const isImage = mime => mime && mime.startsWith('image/');
    const isVideo = mime => mime && mime.startsWith('video/');

    files.forEach(file => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';

      const fileSize = formatFileSize(file.size);
      const fileIcon = getFileIcon(file.mimetype);
      const safeName = escapeHtml(file.originalname);

      fileItem.innerHTML = `
        <div class="file-info">
          <span class="file-icon">${fileIcon}</span>
          <span class="file-name preview-trigger">${safeName}</span>
          <span class="file-size">${fileSize}</span>
        </div>
        <a class="download-btn" aria-label="Download ${safeName}">
          <svg viewBox="0 0 256 256" height="32" width="38" xmlns="http://www.w3.org/2000/svg">
            <path d="M74.34 85.66a8 8 0 0 1 11.32-11.32L120 108.69V24a8 8 0 0 1 16 0v84.69l34.34-34.35a8 8 0 0 1 11.32 11.32l-48 48a8 8 0 0 1-11.32 0ZM240 136v64a16 16 0 0 1-16 16H32a16 16 0 0 1-16-16v-64a16 16 0 0 1 16-16h52.4a4 4 0 0 1 2.83 1.17L111 145a24 24 0 0 0 34 0l23.8-23.8a4 4 0 0 1 2.8-1.2H224a16 16 0 0 1 16 16m-40 32a12 12 0 1 0-12 12a12 12 0 0 0 12-12" fill="currentColor"></path>
          </svg>
        </a>
      `;

      const downloadBtn = fileItem.querySelector('.download-btn');
      downloadBtn.addEventListener('click', () => downloadFile(file.url, file.originalname));

      // Hover preview
      const trigger = fileItem.querySelector('.preview-trigger');
      trigger.addEventListener('mouseenter', (e) => {
        if (isImage(file.mimetype)) {
          previewEl.innerHTML = `<img src="${file.url}" alt="${safeName}" />`;
        } else if (isVideo(file.mimetype)) {
          previewEl.innerHTML = `<video src="${file.url}" muted autoplay loop playsinline></video>`;
        } else {
          previewEl.innerHTML = `
            <div class="preview-file-card">
              <span class="preview-big-icon">${fileIcon}</span>
              <span class="preview-file-name">${safeName}</span>
              <span class="preview-file-size">${fileSize}</span>
            </div>`;
        }
        previewEl.classList.add('visible');
        positionPreview(e, previewEl);
      });

      trigger.addEventListener('mousemove', (e) => positionPreview(e, previewEl));

      trigger.addEventListener('mouseleave', () => {
        previewEl.classList.remove('visible');
      });

      elements.downloadFileList.appendChild(fileItem);
    });


    if (elements.downloadPreview) {
      elements.downloadPreview.style.display = 'block';
    }
  }

  function positionPreview(e, el) {
    const padding = 20;
    let x = e.clientX + padding;
    let y = e.clientY + padding;

    // Check bounds
    if (x + 300 > window.innerWidth) {
      x = e.clientX - 320;
    }
    if (y + 300 > window.innerHeight) {
      y = e.clientY - 320;
    }

    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }

  async function downloadFile(url, originalname) {
    showToast('Starting download...');
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Download failed');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = originalname;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      showToast('Download complete!');
    } catch (err) {
      // Fallback: open in new tab if fetch fails (e.g. CORS)
      window.open(url, '_blank');
      showToast('Opened in new tab — save manually if needed.');
    }
  }

  function openQrScanner() {
    if (elements.qrModal) {
      elements.qrModal.style.display = 'block';

      // Initialize QR scanner
      qrScanner = new Html5QrcodeScanner(
        "qrReader",
        { fps: 10, qrbox: { width: 250, height: 250 } },
        /* verbose= */ false
      );

      qrScanner.render(onScanSuccess, onScanFailure);
    }
  }

  function onScanSuccess(decodedText, decodedResult) {
    console.log(`Code matched = ${decodedText}`, decodedResult);

    // Parse the URL to extract the code
    try {
      const url = new URL(decodedText);
      let code = url.searchParams.get('code');
      
      if (!code && url.pathname.startsWith('/file/')) {
        code = url.pathname.split('/file/')[1];
      }
      
      if (code) {
        elements.receiveInput.value = code;
        showToast('Scanned QR code: ' + code);
        closeQrScanner();
        switchTab('receive');
        receiveFiles();
      } else {
        showToast('Invalid QR code format', true);
      }
    } catch (error) {
      showToast('Invalid QR code', true);
    }

    // Stop scanning and close modal
    closeQrScanner();
  }

  function onScanFailure(error) {
    // console.warn(`Code scan error = ${error}`);
  }

  function closeQrScanner() {
    if (qrScanner) {
      qrScanner.clear().catch(error => {
        console.error("Failed to clear html5QrcodeScanner. ", error);
      });
      qrScanner = null;
    }
    if (elements.qrModal) {
      elements.qrModal.style.display = 'none';
    }
  }

  // Utility functions
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Toast notification function
  function showToast(message, isError = false) {
    let toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toastContainer';
      toastContainer.className = 'toast-container';
      document.body.appendChild(toastContainer);
    }

    const toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' error' : ' success');
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      toast.addEventListener('transitionend', () => {
        toast.remove();
        if (toastContainer.children.length === 0) {
          toastContainer.remove();
        }
      });
    }, 3000); // Toast visible for 3 seconds
  }

  function getFileIcon(mimeType) {
    const iconMap = {
      'image/': '📷',
      'video/': '🎥',
      'audio/': '🎵',
      'application/pdf': '📄',
      'application/zip': '📦',
      'text/': '📄'
    };

    for (const [type, icon] of Object.entries(iconMap)) {
      if (mimeType.startsWith(type)) return icon;
    }

    return '📁';
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Modal handling
  function initModals() {
    // Close modals when clicking outside
    window.addEventListener('click', (e) => {
      if (e.target === elements.codeModal) {
        closeCodeModal();
      }
      if (e.target === elements.qrModal) {
        closeQrScanner();
      }
    });

    if (elements.closeScannerBtn) {
      elements.closeScannerBtn.addEventListener('click', closeQrScanner);
    }
  }

  // Modal actions for copy, share, email buttons
  function initModalActions() {
    if (!elements.copyLinkBtn || !elements.shareBtn || !elements.emailBtn || !elements.codeDisplay) {
      console.error('Modal action elements not found');
      return;
    }

    elements.copyLinkBtn.addEventListener('click', () => {
      const code = elements.codeDisplay.textContent;
      if (!code) return;
      const url = window.location.origin + '/file/' + code;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard!');
      }).catch(() => {
        showToast('Failed to copy link.', true);
      });
    });

    elements.shareBtn.addEventListener('click', () => {
      const code = elements.codeDisplay.textContent;
      if (!code) return;
      const url = window.location.origin + '/file/' + code;
      if (navigator.share) {
        navigator.share({
          title: 'DropIn Files',
          text: 'Check out these files: ' + url,
        }).catch((error) => {
          showToast('Error sharing: ' + error, true);
        });
      } else {
        showToast('Web Share API not supported on this browser.', true);
      }
    });

    elements.emailBtn.addEventListener('click', () => {
      const code = elements.codeDisplay.textContent;
      if (!code) return;
      const url = window.location.origin + '/file/' + code;
      const subject = encodeURIComponent('DropIn File Transfer');
      const body = encodeURIComponent('Check out these files: ' + url);
      window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
    });

    if (elements.extendBtn) {
      elements.extendBtn.addEventListener('click', async () => {
        const code = elements.codeDisplay.textContent;
        if (!code) return;
        try {
          const response = await fetch(`${API_BASE_URL}/api/transfers/${code}/extend`, { method: 'PUT' });
          if (response.ok) {
            showToast('Expiry extended by 24 hours!');
          } else {
            showToast('Failed to extend expiry.', true);
          }
        } catch (error) {
          showToast('Error extending expiry.', true);
        }
      });
    }

    if (elements.deleteBtn) {
      elements.deleteBtn.addEventListener('click', async () => {
        const code = elements.codeDisplay.textContent;
        if (!code) return;
        if (!confirm('Are you sure you want to permanently delete this transfer?')) return;
        try {
          const response = await fetch(`${API_BASE_URL}/api/transfers/${code}`, { method: 'DELETE' });
          if (response.ok) {
            showToast('Transfer deleted!');
            closeCodeModal();
          } else {
            showToast('Failed to delete transfer.', true);
          }
        } catch (error) {
          showToast('Error deleting transfer.', true);
        }
      });
    }
  }

  // Handle URL parameters for auto-fill and fetch
  function handleUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    let code = urlParams.get('code');
    
    // Also check for /file/:id routing
    if (window.location.pathname.startsWith('/file/')) {
      code = window.location.pathname.split('/file/')[1];
    }

    if (code) {
      elements.receiveInput.value = code;
      switchTab('receive');
      receiveFiles();
    }
  }

  // Initialize all functionality
  function init() {
    handleUrlParams();
    initTabs();
    initFileHandling();
    initCodeGeneration();
    initReceive();
    initModals();
    initModalActions();
    initDarkModeToggle();
    updateClearButton();
    updateGenerateButton();
  }


  // Start the application
  init();
});
