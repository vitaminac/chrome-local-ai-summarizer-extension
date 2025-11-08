function storageKeyForTab(tabId) {
  return `ai_summary_for_${tabId}`;
}

chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (!msg || msg.type !== 'start-summarize' || !msg.tabId) return;
  const tabId = msg.tabId;

  try {
    if (!('Summarizer' in self)) {
      chrome.runtime.sendMessage({ type: 'summary-error', error: 'Summarizer API not available in this page/browser.' });
      return;
    }

    const availability = await Summarizer.availability();
    if (availability === 'unavailable') {
      chrome.runtime.sendMessage({ type: 'summary-error', error: 'Summarizer model is unavailable on this device.' });
      return;
    }

    // expect the caller to pass the text to summarize in msg.text.
    const text = (msg && typeof msg.text === 'string' && msg.text.trim()) ? msg.text : '';
    if (!text) {
      chrome.runtime.sendMessage({ type: 'summary-error', error: 'No text provided to summarize.' });
      return;
    }

    let summarizer;
    try {
      summarizer = await Summarizer.create({
        type: msg.options.type,
        format: msg.options.format,
        length: msg.options.length
      });
    } catch (e) {
      console.error(e);
      return;
    }

    try {
      const stream = await summarizer.summarizeStreaming(text, {
        context: msg.options.context
      });
      let acc = "";
      const key = storageKeyForTab(tabId);
      for await (const chunk of stream) {
        acc += chunk;
        await chrome.storage.local.set({ [key]: acc });
        // notify chunk update
        chrome.runtime.sendMessage({ type: 'summary-chunk' });
      }

      // notify completion without resending the accumulated text.
      chrome.runtime.sendMessage({ type: 'summary-done' });
    } catch (e) {
      chrome.runtime.sendMessage({ type: 'summary-error', error: 'Error during streaming: ' + (e && e.message ? e.message : String(e)) });
    }
  } catch (err) {
    chrome.runtime.sendMessage({ type: 'summary-error', error: 'Unexpected error: ' + (err && err.message ? err.message : String(err)) });
  }
});

chrome.tabs.onRemoved.addListener((tabId) => {
  const key = storageKeyForTab(tabId);
  chrome.storage.local.remove(key);
});

