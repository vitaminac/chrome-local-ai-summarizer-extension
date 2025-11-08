(() => {
  // Avoid installing multiple listeners if the script is injected multiple times.
  if (window.__chrome_ai_summarizer_installed) return;
  window.__chrome_ai_summarizer_installed = true;

  // Listen for a start message from the extension popup.
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

      const options = msg.options || {};

      // Create the summarizer in the page context.
      let summarizer;
      try {
        summarizer = await Summarizer.create(options);
      } catch (e) {
        chrome.runtime.sendMessage({ type: 'summary-error', error: 'Error creating summarizer: ' + (e && e.message ? e.message : String(e)) });
        return;
      }

      // Start streaming summarization and forward chunks back to the extension.
      try {
        const stream = await summarizer.summarizeStreaming(text, { context: options.context || '' });
        let acc = '';
        for await (const chunk of stream) {
          // Convert chunk to string if needed
          const chunkStr = typeof chunk === 'string' ? chunk : JSON.stringify(chunk);
          acc += chunkStr;
          chrome.runtime.sendMessage({ type: 'summary-chunk', chunk: chunkStr });
        }

        // Stream finished
        chrome.runtime.sendMessage({ type: 'summary-done', summary: acc });
      } catch (e) {
        chrome.runtime.sendMessage({ type: 'summary-error', error: 'Error during streaming: ' + (e && e.message ? e.message : String(e)) });
      }
    } catch (err) {
      chrome.runtime.sendMessage({ type: 'summary-error', error: 'Unexpected error: ' + (err && err.message ? err.message : String(err)) });
    }
  });
})();
