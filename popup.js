// LinkLocker Popup Script
class LinkLocker {
  constructor() {
    this.links = [];
    this.filteredLinks = [];
    this.isLoggingEnabled = true;
    
    this.initializeElements();
    this.loadData();
    this.attachEventListeners();
  }

  initializeElements() {
    // Get DOM elements
    this.linkList = document.getElementById('linkList');
    this.searchInput = document.getElementById('searchInput');
    this.clearSearch = document.getElementById('clearSearch');
    this.toggleLogging = document.getElementById('toggleLogging');
    this.clearLinks = document.getElementById('clearLinks');
    this.linkCount = document.getElementById('linkCount');
    this.usageCount = document.getElementById('usageCount');
    this.emptyState = document.getElementById('emptyState');
    this.noResults = document.getElementById('noResults');
  }

  async loadData() {
    try {
      // Load links from storage
      const result = await chrome.storage.local.get(['links']);
      this.links = result.links || [];
      this.filteredLinks = [...this.links];

      // Load settings
      const settings = await chrome.storage.sync.get(['isLoggingEnabled']);
      this.isLoggingEnabled = settings.isLoggingEnabled !== false;

      this.updateUI();
    } catch (error) {
      console.error('Error loading data:', error);
    }
  }

  attachEventListeners() {
    // Search functionality
    this.searchInput.addEventListener('input', (e) => {
      this.filterLinks(e.target.value);
    });

    this.clearSearch.addEventListener('click', () => {
      this.searchInput.value = '';
      this.clearSearch.style.display = 'none';
      this.filterLinks('');
    });

    // Toggle logging
    this.toggleLogging.addEventListener('click', () => {
      this.toggleLoggingState();
    });

    // Clear all links
    this.clearLinks.addEventListener('click', () => {
      this.clearAllLinks();
    });

    // Upgrade button
    document.querySelector('.upgrade-btn').addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://linklocker.app/upgrade' });
    });
  }

  filterLinks(query) {
    if (!query.trim()) {
      this.filteredLinks = [...this.links];
      this.clearSearch.style.display = 'none';
    } else {
      this.clearSearch.style.display = 'block';
      const lowercaseQuery = query.toLowerCase();
      this.filteredLinks = this.links.filter(link => 
        link.title.toLowerCase().includes(lowercaseQuery) ||
        link.url.toLowerCase().includes(lowercaseQuery) ||
        link.domain.toLowerCase().includes(lowercaseQuery)
      );
    }
    this.renderLinks();
  }

  async toggleLoggingState() {
    this.isLoggingEnabled = !this.isLoggingEnabled;
    
    // Update UI immediately
    this.updateToggleButton();
    
    // Save to storage
    try {
      await chrome.runtime.sendMessage({
        action: 'toggleLogging',
        enabled: this.isLoggingEnabled
      });
    } catch (error) {
      console.error('Error toggling logging:', error);
    }
  }

  async clearAllLinks() {
    if (confirm('Are you sure you want to clear all links? This cannot be undone.')) {
      try {
        await chrome.runtime.sendMessage({ action: 'clearLinks' });
        this.links = [];
        this.filteredLinks = [];
        this.updateUI();
      } catch (error) {
        console.error('Error clearing links:', error);
      }
    }
  }

  updateUI() {
    this.updateCounts();
    this.updateToggleButton();
    this.renderLinks();
  }

  updateCounts() {
    this.linkCount.textContent = this.links.length;
    this.usageCount.textContent = this.links.length;
  }

  updateToggleButton() {
    const icon = this.toggleLogging.querySelector('.toggle-icon');
    const text = this.toggleLogging.querySelector('.toggle-text');
    
    if (this.isLoggingEnabled) {
      this.toggleLogging.classList.add('active');
      icon.textContent = '◉';
      text.textContent = 'Active';
      this.toggleLogging.title = 'Neural link active - click to disconnect';
    } else {
      this.toggleLogging.classList.remove('active');
      icon.textContent = '◯';
      text.textContent = 'Offline';
      this.toggleLogging.title = 'Neural link offline - click to reconnect';
    }
  }

  renderLinks() {
    // Show/hide empty states
    if (this.links.length === 0) {
      this.emptyState.style.display = 'block';
      this.noResults.style.display = 'none';
      this.linkList.innerHTML = '';
      return;
    }

    if (this.filteredLinks.length === 0) {
      this.emptyState.style.display = 'none';
      this.noResults.style.display = 'block';
      this.linkList.innerHTML = '';
      return;
    }

    this.emptyState.style.display = 'none';
    this.noResults.style.display = 'none';

    // Render filtered links
    this.linkList.innerHTML = this.filteredLinks.map(link => 
      this.createLinkElement(link)
    ).join('');

    // Attach click handlers
    this.attachLinkHandlers();
  }

  createLinkElement(link) {
    const timeAgo = this.getTimeAgo(link.timestamp);
    const favicon = `https://www.google.com/s2/favicons?domain=${link.domain}&sz=16`;
    
    return `
      <div class="link-item" data-id="${link.id}">
        <div class="link-main">
          <img src="${favicon}" alt="" class="favicon" onerror="this.style.display='none'">
          <div class="link-content">
            <div class="link-title" title="${this.escapeHtml(link.title)}">${this.escapeHtml(link.title)}</div>
            <div class="link-url" title="${this.escapeHtml(link.url)}">${this.escapeHtml(link.domain)}</div>
          </div>
          <div class="link-time">${timeAgo}</div>
        </div>
        <div class="link-actions">
          <button class="action-btn copy-btn" data-url="${this.escapeHtml(link.url)}" title="Copy link">
            ⧉
          </button>
          <button class="action-btn open-btn" data-url="${this.escapeHtml(link.url)}" title="Open link">
            ⚡
          </button>
        </div>
      </div>
    `;
  }

  attachLinkHandlers() {
    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.copyToClipboard(btn.dataset.url);
      });
    });

    // Open buttons
    document.querySelectorAll('.open-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        chrome.tabs.create({ url: btn.dataset.url });
      });
    });

    // Link items (click to open)
    document.querySelectorAll('.link-item').forEach(item => {
      item.addEventListener('click', () => {
        const openBtn = item.querySelector('.open-btn');
        if (openBtn) {
          chrome.tabs.create({ url: openBtn.dataset.url });
        }
      });
    });
  }

  async copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Data stream copied to neural buffer');
    } catch (error) {
      console.error('Failed to copy:', error);
      this.showToast('Neural buffer access denied');
    }
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 100);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => document.body.removeChild(toast), 300);
    }, 2000);
  }

  getTimeAgo(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(timestamp).toLocaleDateString();
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new LinkLocker();
});