function storageKeyForTab(tabId) {
  return `ai_summary_for_${tabId}`;
}

chrome.tabs.onRemoved.addListener((tabId) => {
  const key = storageKeyForTab(tabId);
  chrome.storage.local.remove(key);
});

