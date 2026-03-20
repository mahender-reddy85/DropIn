const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'http://localhost:3001' : 'https://dropin-dn6i.onrender.com';

document.addEventListener('DOMContentLoaded', function () {
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
    copyLinkBtn: document.getElementById('copyLinkBtn'),
    shareBtn: document.getElementById('shareBtn'),
    emailBtn: document.getElementById('emailBtn'),
    themeToggleBtn: document.getElementById('themeToggle'),
    downloadPreview: document.getElementById('downloadPreview'),
    downloadFileList: document.getElementById('downloadFileList'),
    extendBtn: document.getElementById('extendBtn'),
    deleteBtn: document.getElementById('deleteBtn'),
    downloadAllBtn: document.getElementById('downloadAllBtn'),
    dragDropOverlay: document.getElementById('dragDropOverlay'),
    uploadModal: document.getElementById('uploadModal'),
    progressBar: document.getElementById('progressBar'),
    uploadStatus: document.getElementById('uploadStatus'),
    totalSizeDisplay: document.getElementById('totalSizeDisplay'),
    fileCount: document.getElementById('fileCount'),
    totalBytes: document.getElementById('totalBytes'),
    transferStatusDisplay: document.getElementById('transferStatusDisplay')
  };

  // State management
  let selectedFiles = [];
  let currentCode = null;
  let qrScanner = null;

  // Dark mode toggle
  function initDarkModeToggle() {
    if (!elements.themeToggleBtn) {
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

    // Check for code in URL on load
    checkUrlParams();
  }

  function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      elements.receiveInput.value = code;
      switchTab('receive');
      // Tiny delay to ensure UI transition
      setTimeout(() => {
        receiveFiles();
      }, 300);
    }
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
      elements.browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        elements.fileInput.click();
      });
    }

    // Make the entire drop zone clickable
    elements.dropArea.addEventListener('click', () => {
      elements.fileInput.click();
    });

    // Global drag and drop overlay logic
    if (elements.dragDropOverlay) {
      ['dragenter', 'dragover'].forEach(eventName => {
        window.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Ensure we only show if it contains files
          if (e.dataTransfer.types && Array.from(e.dataTransfer.types).includes('Files')) {
            elements.dragDropOverlay.classList.add('active');
          }
        }, false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        window.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          // Only remove if we're actually leaving the window or dropping
          if (e.type === 'drop' || (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight)) {
            elements.dragDropOverlay.classList.remove('active');
          }
        }, false);
      });

      window.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles({ target: { files } }); // Pass as an event-like object
      }, false);
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
    const files = Array.isArray(e) ? e : Array.from(e.target.files || []);
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
    updateTotalSizeDisplay();
  }

  function updateTotalSizeDisplay() {
    if (!elements.totalSizeDisplay || !elements.fileCount || !elements.totalBytes) return;

    if (selectedFiles.length === 0) {
      elements.totalSizeDisplay.style.display = 'none';
      return;
    }

    const totalBytesCount = selectedFiles.reduce((acc, file) => acc + (file.size || 0), 0);
    elements.fileCount.textContent = selectedFiles.length;
    elements.totalBytes.textContent = formatFileSize(totalBytesCount);
    elements.totalSizeDisplay.style.display = 'flex';
  }

  function createFileItem(file, index) {
    const fileItem = document.createElement('div');
    fileItem.className = 'file-item';

    const fileSize = formatFileSize(file.size);
    const fileIcon = getFileIcon(file.type);

    const fileName = file.name || file.originalname || 'Unknown';
    const safeName = escapeHtml(fileName);

    fileItem.innerHTML = `
      <div class="file-info">
        <span class="file-icon">${fileIcon}</span>
        <div class="file-name-container">
          <span class="file-name">${safeName}</span>
        </div>
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

    // Show progress modal
    if (elements.uploadModal) {
      elements.uploadModal.style.display = 'block';
      if (elements.progressBar) elements.progressBar.style.width = '0%';
      if (elements.uploadStatus) elements.uploadStatus.textContent = 'Preparing files for upload...';
    }

    const formData = new FormData();
    selectedFiles.forEach(file => {
      formData.append('files', file);
    });

    const pwInput = document.getElementById('uploadPassword');
    if (pwInput && pwInput.value.trim().length > 0) {
      formData.append('password', pwInput.value.trim());
    }

    try {
      // Use XHR for progress tracking
      const xhr = new XMLHttpRequest();

      const uploadPromise = new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percent = (e.loaded / e.total) * 100;
            if (elements.progressBar) {
              // We reserve 20% for server-side processing
              const visualPercent = percent * 0.8;
              elements.progressBar.style.width = visualPercent + '%';
              if (elements.uploadStatus) {
                elements.uploadStatus.textContent = `Uploading: ${Math.round(percent)}%`;
              }
            }
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText));
          } else {
            let errMsg = 'Upload failed';
            try {
              const errData = JSON.parse(xhr.responseText);
              errMsg = errData.error || errMsg;
            } catch (e) { }
            reject(new Error(errMsg));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Network error during upload')));

        xhr.open('POST', `${API_BASE_URL}/api/upload`);
        xhr.send(formData);
      });

      // Switch status once files are on the server
      const checkServerStatus = setInterval(() => {
        if (xhr.readyState === XMLHttpRequest.DONE) {
          clearInterval(checkServerStatus);
          return;
        }
        if (xhr.upload && elements.progressBar) {
          const currentWidth = parseFloat(elements.progressBar.style.width);
          if (currentWidth >= 80 && currentWidth < 98) {
            if (elements.uploadStatus) elements.uploadStatus.textContent = 'Server is processing and securing your cloud storage...';
            elements.progressBar.style.width = (currentWidth + 0.5) + '%';
          }
        }
      }, 500);

      const data = await uploadPromise;
      clearInterval(checkServerStatus);

      // Complete the progress
      if (elements.progressBar) elements.progressBar.style.width = '100%';
      setTimeout(() => { if (elements.uploadModal) elements.uploadModal.style.display = 'none'; }, 300);

      currentCode = data.code;

      if (elements.codeDisplay) {
        elements.codeDisplay.textContent = currentCode;
      }

      // Generate and display QR code
      if (elements.qrCodeContainer) {
        elements.qrCodeContainer.innerHTML = '';
        const fileUrl = window.location.origin + '/?code=' + currentCode;
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
        // Reset status
        if (elements.transferStatusDisplay) {
           elements.transferStatusDisplay.classList.remove('done');
           elements.transferStatusDisplay.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Waiting for receiver...';
        }
        startTransferStatusPolling(currentCode);
      }

      showToast('Files uploaded successfully!');
    } catch (error) {
      console.error('Upload error:', error);
      if (elements.uploadModal) elements.uploadModal.style.display = 'none';
      showToast(error.message || 'Failed to upload files. Please try again.', true);
    }
  }

  let statusPollingInterval = null;

  function startTransferStatusPolling(code) {
    stopTransferStatusPolling(); // Clear existing if any
    
    statusPollingInterval = setInterval(async () => {
      if (!code) return;
      try {
        const response = await fetch(`${API_BASE_URL}/api/info/${code}`);
        if (!response.ok) {
           // If 404 or 410, it likely expired already (successfully downloaded and deleted)
           if (response.status === 404 || response.status === 410) {
              setTransferDone();
              stopTransferStatusPolling();
           }
           return;
        }
        const data = await response.json();
        if (data.isDownloaded) {
           setTransferDone();
           stopTransferStatusPolling();
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 5000); // Poll every 5 seconds
  }

  function stopTransferStatusPolling() {
    if (statusPollingInterval) {
      clearInterval(statusPollingInterval);
      statusPollingInterval = null;
    }
  }

  function setTransferDone() {
    if (elements.transferStatusDisplay) {
      elements.transferStatusDisplay.classList.add('done');
      elements.transferStatusDisplay.innerHTML = '<i class="fas fa-check-circle"></i> Files Downloaded! Transfer Complete.';
      showToast('🎉 Your receiver has downloaded the files! The link is now expiring.');
    }
  }



  function closeCodeModal() {
    stopTransferStatusPolling();
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
    if (elements.downloadAllBtn) {
      elements.downloadAllBtn.addEventListener('click', downloadAllFiles);
    }
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
      const password = (pwInput && pwInput.value.trim()) ? pwInput.value.trim() : '';

      let url = `${API_BASE_URL}/api/info/${code}`;
      if (password) {
        url += `?password=${encodeURIComponent(password)}`;
      }

      const response = await fetch(url, {
        method: 'GET'
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

      displayDownloadFiles(data.files, code);
      currentCode = code; // Store current code for bulk download
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

      // Close preview on clicking anywhere outside
      document.addEventListener('click', () => {
        previewEl.classList.remove('visible');
      });
    }

    const isImage = mime => mime && mime.startsWith('image/');
    const isVideo = mime => mime && mime.startsWith('video/');
    const isAudio = mime => mime && mime.startsWith('audio/');

    files.forEach(file => {
      const fileItem = document.createElement('div');
      fileItem.className = 'file-item';

      const fileSize = formatFileSize(file.size);
      const fileIcon = getFileIcon(file.mimetype);
      const safeName = escapeHtml(file.originalname);
      const displayName = truncateFileName(file.originalname, 25);

      fileItem.innerHTML = `
        <div class="file-info">
          <span class="file-icon">${fileIcon}</span>
          <span class="file-name preview-trigger" title="${safeName}">${displayName}</span>
          <span class="file-size">${fileSize}</span>
        </div>
      `;

      // Show preview trigger
      const trigger = fileItem.querySelector('.preview-trigger');

      const showPreview = (e) => {
        e.stopPropagation();
        if (isImage(file.mimetype)) {
          previewEl.innerHTML = `<img src="${file.url}" alt="${safeName}" />`;
        } else if (isVideo(file.mimetype)) {
          previewEl.innerHTML = `<video src="${file.url}" muted autoplay loop playsinline></video>`;
        } else if (isAudio(file.mimetype)) {
          previewEl.innerHTML = `
            <div class="preview-file-card">
              <span class="preview-big-icon"><i class="fas fa-music"></i></span>
              <span class="preview-file-name">${safeName}</span>
              <audio controls src="${file.url}" style="width: 100%; margin-top: 10px;"></audio>
            </div>`;
        } else {
          // General Preview for PDFs and others
          previewEl.innerHTML = `
            <div class="preview-file-card">
              <span class="preview-big-icon">${fileIcon}</span>
              <span class="preview-file-name">${safeName}</span>
              <span class="preview-file-size">${fileSize}</span>
            </div>`;
        }
        previewEl.classList.add('visible');
        if (window.innerWidth > 768) {
          positionPreview(e, previewEl);
        }
      };

      trigger.addEventListener('mouseenter', (e) => {
        if (window.innerWidth > 768) showPreview(e);
      });

      trigger.addEventListener('mousemove', (e) => {
        if (window.innerWidth > 768) positionPreview(e, previewEl);
      });

      trigger.addEventListener('mouseleave', () => {
        if (window.innerWidth > 768) previewEl.classList.remove('visible');
      });

      trigger.addEventListener('click', showPreview);

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
    console.log('QR scanned, raw text:', decodedText);

    try {
      let code = null;

      // Handle different QR code formats
      if (decodedText.includes('dropin-dn6i.onrender.com')) {
        // Full URL format
        const url = new URL(decodedText);
        code = url.searchParams.get('code');

        if (!code && url.pathname.startsWith('/file/')) {
          code = url.pathname.split('/file/')[1];
        }
      } else if (decodedText.includes('localhost:3001')) {
        // Local development URL
        const url = new URL(decodedText);
        code = url.searchParams.get('code');

        if (!code && url.pathname.startsWith('/file/')) {
          code = url.pathname.split('/file/')[1];
        }
      } else {
        // Direct code format (just the code)
        code = decodedText.trim();
      }

      console.log('Extracted code:', code);

      if (code) {
        elements.receiveInput.value = code;
        console.log('QR scanned, code:', code);
        console.log('Receive input value set to:', elements.receiveInput.value);
        showToast('Scanned QR code: ' + code);
        closeQrScanner();
        switchTab('receive');
        console.log('Tab switched to receive');
        // Small delay to ensure tab switch is complete
        setTimeout(() => {
          console.log('About to call receiveFiles with code:', elements.receiveInput.value);
          receiveFiles();
        }, 100);
      } else {
        showToast('Invalid QR code format', true);
      }
    } catch (error) {
      console.error('QR scan error:', error);
      showToast('Invalid QR code', true);
    }

    // Stop scanning and close modal
    closeQrScanner();
  }

  function onScanFailure(error) {
    // QR scan error handling
  }

  function closeQrScanner() {
    if (qrScanner) {
      qrScanner.clear().catch(() => {
        // Handle scanner clear error silently
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

  function truncateFileName(filename, maxLength = 10) {
    if (filename.length <= maxLength) return filename;

    // Get file extension
    const lastDotIndex = filename.lastIndexOf('.');
    const extension = lastDotIndex > -1 ? filename.substring(lastDotIndex) : '';
    const nameWithoutExt = lastDotIndex > -1 ? filename.substring(0, lastDotIndex) : filename;

    // Truncate name part and add extension back
    const truncatedName = nameWithoutExt.substring(0, maxLength) + '...' + extension;
    return truncatedName;
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
      const url = window.location.origin + '/?code=' + code;
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard!');
      }).catch(() => {
        showToast('Failed to copy link.', true);
      });
    });

    elements.shareBtn.addEventListener('click', () => {
      const code = elements.codeDisplay.textContent;
      if (!code) return;
      const url = window.location.origin + '/?code=' + code;
      if (navigator.share) {
        navigator.share({
          title: 'DropIn Files',
          text: 'Check out these files: ' + url,
          url: url
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
      const url = window.location.origin + '/?code=' + code;
      const subject = encodeURIComponent('DropIn File Transfer');
      const body = encodeURIComponent('Check out these files: ' + url);

      // Use Gmail compose URL as primary for better experience on desktop browsers
      const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=&su=${subject}&body=${body}`;

      // Check if user is likely on a browser where we can open a tab
      if (window.innerWidth > 768) {
        window.open(gmailUrl, '_blank');
      } else {
        window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
      }
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

      // Clean up URL so refresh goes to homepage
      window.history.replaceState({}, document.title, window.location.pathname);

      switchTab('receive');
      receiveFiles();
    }
  }

  async function downloadAllFiles() {
    if (!currentCode) {
      showToast('No transfer code available');
      return;
    }

    showToast('Preparing bulk download...');

    try {
      const pwInput = document.getElementById('receivePassword');
      const password = pwInput ? pwInput.value.trim() : '';

      // Construct URL with password if provided
      let downloadUrl = `${API_BASE_URL}/api/download/${currentCode}`;
      if (password) {
        downloadUrl += `?password=${encodeURIComponent(password)}`;
      }

      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast('Downloading all files...');
    } catch (error) {
      console.error('Bulk download error:', error);
      showToast('Failed to download files', true);
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
