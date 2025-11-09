function storageKeyForTab(tabId) {
  return `ai_summary_for_${tabId}`;
}

async function summarize(text, options) {
  if (!text || typeof text !== 'string') {
    throw new Error('No text provided to summarize.');
  }

  if (!('LanguageDetector' in self)) {
    throw new Error('Language Detector API not available in this page/browser.');
  }

  const detector = await LanguageDetector.create({
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        chrome.runtime.sendMessage({ type: 'download-progress', loaded: e.loaded, total: e.total });
      });
    },
  });
  const results = await detector.detect(text);
  const detectedLanguage = results[0].detectedLanguage;

  if (!('Summarizer' in self)) {
    throw new Error('Summarizer API not available in this page/browser.');
  }

  const availability = await Summarizer.availability();
  if (availability === 'unavailable') {
    throw new Error('Summarizer model is unavailable on this device.');
  }

  const summarizer = await Summarizer.create({
    expectedInputLanguages: [detectedLanguage],
    outputLanguage: detectedLanguage,
    expectedContextLanguages: [detectedLanguage],
    type: options.type,
    format: options.format,
    length: options.length,
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        chrome.runtime.sendMessage({ type: 'download-progress', loaded: e.loaded, total: e.total });
      });
    }
  });

  chrome.runtime.sendMessage({ type: 'download-complete' });

  const stream = await summarizer.summarizeStreaming(text, {
    context: options.context
  });

  return stream;
}

function getSelectedElementText() {
  return new Promise((resolve, reject) => {
    let lastElem = null;
    let lastOutline = '';

    function clearHighlight() {
      if (lastElem) {
        try { lastElem.style.outline = lastOutline || ''; } catch (e) { }
        lastElem = null;
        lastOutline = '';
      }
    }

    function onMove(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el || el === document.documentElement || el === document.body) {
        clearHighlight();
        return;
      }
      if (el !== lastElem) {
        clearHighlight();
        lastElem = el;
        try {
          lastOutline = el.style.outline || '';
          el.style.outline = '3px solid #ff9800';
        } catch (err) { /* ignore */ }
      }
    }

    function cleanup() {
      clearHighlight();
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('keydown', onKey, true);
    }

    async function onClick(e) {
      try { e.preventDefault(); e.stopPropagation(); } catch (err) { }
      const el = document.elementFromPoint(e.clientX, e.clientY);
      let text = '';
      try {
        if (el) text = (el.innerText || el.textContent || '').trim();
      } catch (err) { text = ''; }

      cleanup();

      if (text) {
        resolve(text)
      } else {
        reject("No text found in selection.");
      }
    }

    function onKey(e) {
      if (e.key === 'Escape') {
        cleanup();
        chrome.runtime.sendMessage({ type: 'selection-cancelled' });
      }
    }

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    document.addEventListener('keydown', onKey, true);
  });
}

(() => {
  if (window.__chrome_ai_summarizer_content_script_installed) return;
  window.__chrome_ai_summarizer_content_script_installed = true;

  chrome.runtime.onMessage.addListener(async (msg) => {
    if (!msg || !msg.type) return;


    let text = "";
    switch (msg.type) {
      case "select-page":
        text = document.body.innerText || "";
        break;
      case "select-element":
        text = await getSelectedElementText();
        break;
    }

    chrome.runtime.sendMessage({ type: 'processing-selection' });

    let stream;
    try {
      stream = await summarize(text, {
        type: 'key-points',
        format: 'plain-text',
        length: msg.length,
        context: document.title || ''
      });
    } catch (error) {
      chrome.runtime.sendMessage({ type: 'summary-error', error: error.message });
      return;
    }

    const storageKey = storageKeyForTab(msg.tabId);
    let summary = "";
    for await (const chunk of stream) {
      summary += chunk;
      await chrome.storage.local.set({ [storageKey]: summary });
      chrome.runtime.sendMessage({ type: 'summary-chunk', tabId: msg.tabId });
    }

    chrome.runtime.sendMessage({ type: 'summary-done' });
  });
})();
