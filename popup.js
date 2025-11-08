document.addEventListener('DOMContentLoaded', () => {
  const summarizeBtn = document.getElementById('summarizeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const status = document.getElementById('status');
  const output = document.getElementById('output');
  clearBtn.addEventListener('click', () => {
    output.value = '';
    status.textContent = '';
  });

  // Keep track of which tab we are summarizing so we only accept messages for that tab
  let activeTabId = null;

  // Receive streaming chunks from the content script
  chrome.runtime.onMessage.addListener((msg, sender) => {
    if (!sender || !sender.tab) return;
    if (sender.tab.id !== activeTabId) return; // ignore messages from other tabs

    if (msg.type === 'summary-chunk') {
      // append chunk progressively
      output.value += msg.chunk;
      status.textContent = 'Summarizing...';
    } else if (msg.type === 'summary-done') {
      status.textContent = 'Summary complete';
      // ensure final text present
      if (msg.summary) output.value = msg.summary;
      activeTabId = null;
    } else if (msg.type === 'summary-error') {
      status.textContent = 'Error: ' + (msg.error || 'Unknown');
      activeTabId = null;
    }
  });

  summarizeBtn.addEventListener('click', async () => {
    status.textContent = 'Preparing to summarize...';
    output.value = '';

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        status.textContent = 'No active tab found.';
        return;
      }
      const tab = tabs[0];
      activeTabId = tab.id;

      status.textContent = 'Injecting summarizer script into page...';

      // Inject our content script file (runs as a content script and can use chrome.runtime)
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-summarizer.js']
      });

      status.textContent = 'Starting streaming summarization...';

      // Send a message to the content script to start summarization. Options can be customized.
      await chrome.tabs.sendMessage(tab.id, {
        type: 'start-summarize',
        options: {
          type: 'key-points',
          format: 'plain-text',
          length: 'short',
          context: 'Summarize the visible text of this page.'
        }
      });
    } catch (err) {
      status.textContent = 'Extension error: ' + (err && err.message ? err.message : String(err));
      activeTabId = null;
    }
  });
});
