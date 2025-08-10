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
    themeToggleBtn: document.getElementById('themeToggle')
  };

  // State management
  let selectedFiles = [];
  let currentCode = null;

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

  function generateCode() {
    if (selectedFiles.length === 0) {
      showToast('Please select files first');
      return;
    }

    currentCode = generateUniqueCode();

    if (elements.codeDisplay) {
      elements.codeDisplay.textContent = currentCode;
    }

    // Generate and display QR code
    if (elements.qrCodeContainer) {
      elements.qrCodeContainer.innerHTML = '';
      new QRCode(elements.qrCodeContainer, {
        text: currentCode,
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
  }

  function generateUniqueCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
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

  function receiveFiles() {
    const code = elements.receiveInput ? elements.receiveInput.value.trim() : '';

    if (!code) {
      showToast('Please enter a code');
      return;
    }

    showToast('Receiving files with code: ' + code);
  }

  function openQrScanner() {
    if (elements.qrModal) {
      elements.qrModal.style.display = 'block';
      setTimeout(() => {
        const simulatedCode = 'ABCD12';
        elements.receiveInput.value = simulatedCode;
        showToast('Scanned QR code: ' + simulatedCode);
        elements.qrModal.style.display = 'none';
      }, 3000);
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
        if (elements.qrModal) elements.qrModal.style.display = 'none';
      }
    });

    if (elements.closeScannerBtn) {
      elements.closeScannerBtn.addEventListener('click', () => {
        if (elements.qrModal) elements.qrModal.style.display = 'none';
      });
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
      navigator.clipboard.writeText(code).then(() => {
        showToast('Code copied to clipboard!');
      }).catch(() => {
        showToast('Failed to copy code.', true);
      });
    });

    elements.shareBtn.addEventListener('click', () => {
      const code = elements.codeDisplay.textContent;
      if (!code) return;
      if (navigator.share) {
        navigator.share({
          title: 'SwiftShare Code',
          text: 'Use this code to receive files: ' + code,
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
      const subject = encodeURIComponent('SwiftShare File Transfer Code');
      const body = encodeURIComponent('Use this code to receive files: ' + code);
      window.location.href = 'mailto:?subject=' + subject + '&body=' + body;
    });
  }

  // Initialize all functionality
  function init() {
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
