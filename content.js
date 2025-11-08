function startSelect() {
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

    // Send selected-element for UI feedback and hand the actual summarization responsibility back to the popup.
    try {
      chrome.runtime.sendMessage({ type: 'selected-element', text });
    } catch (err) {
      try { chrome.runtime.sendMessage({ type: 'selected-element', text }); } catch (e) { }
    }

    return;
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      cleanup();
      chrome.runtime.sendMessage({ type: 'selected-element', text: null, cancelled: true });
    }
  }

  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKey, true);
}

(() => {
  if (window.__chrome_ai_summarizer_content_script_installed) return;
  window.__chrome_ai_summarizer_content_script_installed = true;

  // Listen for selection mode trigger
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg) return;
    switch (msg.type) {
      case "select-element":
        startSelect();
        break;
      case "select-page":
        chrome.runtime.sendMessage({ type: 'selected-element', text: document.body.innerText || "" });
        break;
    }
  });
})();
