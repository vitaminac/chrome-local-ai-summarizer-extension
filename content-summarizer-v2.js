(() => {
  if (window.__chrome_ai_summarizer_v2_installed) return;
  window.__chrome_ai_summarizer_v2_installed = true;

  chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    if (!msg || msg.type !== 'start-summarize') return;

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

      const text = document.body && document.body.innerText ? document.body.innerText : '';
      if (!text || !text.trim()) {
        chrome.runtime.sendMessage({ type: 'summary-error', error: 'No text found on the page.' });
        return;
      }

      let summarizer;
      try {
        summarizer = await Summarizer.create(msg.options);
      } catch (e) {
        chrome.runtime.sendMessage({ type: 'summary-error', error: 'Error creating summarizer: ' + (e && e.message ? e.message : String(e)) });
        return;
      }

      try {
        // Do NOT truncate locally. Instead rely on the summarizer instruction included
        // in options.context (for example: "Please limit the summary to at most N words...").
        const stream = await summarizer.summarizeStreaming(text, msg.options);
        let acc = '';
        for await (const chunk of stream) {
          const chunkStr = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
          acc += chunkStr;
          chrome.runtime.sendMessage({ type: 'summary-chunk', chunk: chunkStr });
        }

        chrome.runtime.sendMessage({ type: 'summary-done', summary: acc });
      } catch (e) {
        chrome.runtime.sendMessage({ type: 'summary-error', error: 'Error during streaming: ' + (e && e.message ? e.message : String(e)) });
      }
    } catch (err) {
      chrome.runtime.sendMessage({ type: 'summary-error', error: 'Unexpected error: ' + (err && err.message ? err.message : String(err)) });
    }
  });
})();
