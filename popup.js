function storageKeyForTab(tabId) {
  return `ai_summary_for_${tabId}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const summarizeBtn = document.getElementById('summarizeBtn');
  const selectBtn = document.getElementById('selectBtn');
  const status = document.getElementById('status');
  const output = document.getElementById('output');

  // keep track of which tab we are summarizing so we only accept messages for that tab
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs || tabs.length === 0) {
    console.error("No active tab found.")
    return;
  }
  const activeTab = tabs[0];

  async function updateContet() {
    const key = storageKeyForTab(activeTab.id);
    const items = await chrome.storage.local.get(key);
    const content = items[key] || "";
    // set textContent so the container grows with the text
    output.textContent = content;
    output.scrollTop = output.scrollHeight;
  }
  updateContet();

  // inject the content script
  await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ['content.js'] });

  chrome.runtime.onMessage.addListener(async (msg, sender) => {
    if (!msg || !msg.type) return;

    // selected-element messages come from the content script and include sender.tab
    if (msg.type === 'selected-element') {
      if (!sender || !sender.tab || !sender.tab.id || sender.tab.id !== activeTab.id) return;
      if (msg.text) {
        status.textContent = 'Selected element — summarizing...';
        startSummarizeWithText(msg.text);
      } else {
        status.textContent = 'Selection canceled or empty.';
      }
      return;
    }

    // For all other messages, ensure they are for the active tab
    if (!msg.tabId || msg.tabId !== activeTab.id) return;

    switch (msg.type) {
      case 'download-progress':
        status.textContent = `Downloading model — ${msg.loaded} of ${msg.total}`;
        break;
      case 'download-complete':
        status.textContent = 'Model ready — summarizing...';
        break;
      case 'summary-chunk':
        await updateContet();
        status.textContent = 'Summarizing...';
        break;
      case 'summary-done':
        status.textContent = 'Summary complete';
        break;
      case 'summary-error':
        status.textContent = 'Error: ' + (msg.error || 'Unknown');
        break;
      default:
        // ignore unknown message types
        break;
    }
  });

  async function startSummarizeWithText(textToSummarize) {
    status.textContent = 'Preparing to summarize...';
    // always clear previous content at the beginning of a new summarization.
    output.textContent = '';

    try {
      status.textContent = 'starting streaming summarization...';

      // Read the selected length radio (short/medium/long). Popup is the single
      // source of truth for the length.
      const sel = document.querySelector('input[name="length"]:checked');
      const lengthBucket = sel ? sel.value : 'medium';

      // send a message to the content script to start summarization. Provide the text
      await chrome.runtime.sendMessage({
        type: 'start-summarize',
        text: textToSummarize,
        options: {
          type: 'key-points',
          format: 'plain-text',
          length: lengthBucket,
          context: document.title || ''
        },
        tabId: activeTab.id
      });
    } catch (err) {
      console.error(err);
    }
  }

  summarizeBtn.addEventListener('click', async function () {
    await chrome.tabs.sendMessage(activeTab.id, { type: 'select-page' });
  });

  selectBtn.addEventListener('click', async () => {
    status.textContent = 'click an element on the page to summarize (Esc to cancel)...';
    await chrome.tabs.sendMessage(activeTab.id, { type: 'select-element' });
  });
});
