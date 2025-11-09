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

  async function updateContent() {
    const key = storageKeyForTab(activeTab.id);
    const items = await chrome.storage.local.get(key);
    const content = items[key] || "";
    // set textContent so the container grows with the text
    output.textContent = content;
    output.scrollTop = output.scrollHeight;
  }

  // read last summary
  updateContent();

  // inject the content script
  await chrome.scripting.executeScript({
    target: { tabId: activeTab.id },
    files: ['content.js']
  });

  chrome.runtime.onMessage.addListener(async (msg) => {
    if (!msg || !msg.type) return;

    switch (msg.type) {
      case 'processing-selection':
        status.textContent = 'Summarizing the selected text...';
        output.textContent = '';
        break;
      case 'download-progress':
        status.textContent = `Downloading model — ${msg.loaded} of ${msg.total}`;
        break;
      case 'download-complete':
        status.textContent = 'Model ready — summarizing...';
        break;
      case 'summary-chunk':
        await updateContent();
        status.textContent = 'Summarizing...';
        break;
      case 'summary-done':
        await updateContent();
        status.textContent = 'Summary complete';
        break;
      case 'summary-error':
        status.textContent = 'Error: ' + (msg.error || 'Unknown');
        break;
      case 'selection-cancelled':
        status.textContent = 'Selection cancelled';
        break;
      default:
        // ignore unknown message types
        break;
    }
  });

  async function triggerSummarize(type) {
    // always clear previous content at the beginning of a new summarization.
    output.textContent = '';

    // read the selected length radio (short/medium/long).
    // popup is the single source of truth for the length.
    const sel = document.querySelector('input[name="length"]:checked');
    const lengthBucket = sel ? sel.value : 'medium';

    await chrome.tabs.sendMessage(activeTab.id, {
      type: type,
      length: lengthBucket,
      tabId: activeTab.id
    });
  }

  summarizeBtn.addEventListener('click', async function () {
    await triggerSummarize('select-page');
  });

  selectBtn.addEventListener('click', async () => {
    status.textContent = 'Click an element on the page to summarize (Esc to cancel)...';
    await triggerSummarize('select-element');
  });
});
