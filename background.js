// LinkLocker Background Script
// Monitors tab changes and automatically logs links

const MAX_LINKS = 200; // Free tier limit

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('LinkLocker installed');
  
  // Set default settings
  chrome.storage.sync.set({
    isLoggingEnabled: true,
    maxLinks: MAX_LINKS
  });
});

// Listen for tab updates (URL changes, page loads)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only log when the page is completely loaded and has a URL
  if (changeInfo.status === 'complete' && tab.url && tab.title) {
    await logLink(tab.url, tab.title, tabId);
  }
});

// Listen for tab activation (switching between tabs)
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (tab.url && tab.title && tab.status === 'complete') {
      await logLink(tab.url, tab.title, activeInfo.tabId);
    }
  } catch (error) {
    console.log('Error getting active tab:', error);
  }
});

async function logLink(url, title, tabId) {
  try {
    // Check if logging is enabled
    const settings = await chrome.storage.sync.get(['isLoggingEnabled']);
    if (!settings.isLoggingEnabled) {
      return;
    }

    // Skip chrome:// URLs, extensions, and data URLs
    if (url.startsWith('chrome://') || 
        url.startsWith('chrome-extension://') || 
        url.startsWith('data:') ||
        url.startsWith('about:') ||
        url === 'chrome://newtab/') {
      return;
    }

    // Get existing links
    const result = await chrome.storage.local.get(['links']);
    let links = result.links || [];

    // Check if this link was already logged recently (within last 30 seconds)
    const thirtySecondsAgo = Date.now() - 30000;
    const recentLink = links.find(link => 
      link.url === url && link.timestamp > thirtySecondsAgo
    );

    if (recentLink) {
      return; // Don't log duplicate recent links
    }

    // Create new link entry
    const newLink = {
      id: Date.now() + Math.random(), // Unique ID
      url: url,
      title: title || 'Untitled',
      timestamp: Date.now(),
      domain: new URL(url).hostname,
      tabId: tabId
    };

    // Add to beginning of array (most recent first)
    links.unshift(newLink);

    // Keep only the most recent MAX_LINKS
    if (links.length > MAX_LINKS) {
      links = links.slice(0, MAX_LINKS);
    }

    // Save back to storage
    await chrome.storage.local.set({ links: links });

    // Update badge with link count
    const linkCount = links.length;
    chrome.action.setBadgeText({
      text: linkCount > 99 ? 'MAX' : linkCount.toString()
    });
    chrome.action.setBadgeBackgroundColor({ color: '#00ffff' });

  } catch (error) {
    console.error('Error logging link:', error);
  }
}

// Handle messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'clearLinks') {
    chrome.storage.local.set({ links: [] });
    chrome.action.setBadgeText({ text: '' });
    sendResponse({ success: true });
  }
  
  if (request.action === 'toggleLogging') {
    chrome.storage.sync.set({ isLoggingEnabled: request.enabled });
    sendResponse({ success: true });
  }
});