document.addEventListener('DOMContentLoaded', () => {
  const summarizeBtn = document.getElementById('summarizeBtn');
  const clearBtn = document.getElementById('clearBtn');
  const status = document.getElementById('status');
  const output = document.getElementById('output');

  clearBtn.addEventListener('click', () => {
    output.value = '';
    status.textContent = '';
  });

  summarizeBtn.addEventListener('click', async () => {
    status.textContent = 'Getting page text...';
    output.value = '';

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        status.textContent = 'No active tab found.';
        return;
      }
      const tab = tabs[0];

      status.textContent = 'Running summarization in page context...';

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: async () => {
          try {
            if (!('Summarizer' in self)) {
              return { error: 'Summarizer API not available in this browser or page.' };
            }

            const availability = await Summarizer.availability();
            if (availability === 'unavailable') {
              return { error: 'Summarizer model is unavailable on this device.' };
            }

            // Use the visible text of the page
            const text = document.body && document.body.innerText ? document.body.innerText : '';
            if (!text || !text.trim()) {
              return { error: 'No text found on the page.' };
            }

            // Create a summarizer. This must be done in a user-activated context where possible.
            const options = {
              type: 'key-points',
              format: 'plain-text',
              length: 'short',
              monitor(m) {
                // no-op monitor; download progress events can be observed here if needed
                m.addEventListener('downloadprogress', () => {});
              }
            };

            // If user activation is required, navigator.userActivation.isActive can be checked here.
            try {
              const summarizer = await Summarizer.create(options);
              const summary = await summarizer.summarize(text, { context: 'Summarize the visible text of this page.' });

              // summary may be a string; ensure we return a string
              return { summary: String(summary) };
            } catch (e) {
              return { error: 'Error creating or running summarizer: ' + (e && e.message ? e.message : String(e)) };
            }
          } catch (err) {
            return { error: 'Unexpected error in page script: ' + (err && err.message ? err.message : String(err)) };
          }
        }
      });

      // results is an array of InjectionResult objects; take first
      const r = results && results[0] && results[0].result ? results[0].result : null;
      if (!r) {
        status.textContent = 'No result from page script.';
        return;
      }
      if (r.error) {
        status.textContent = 'Error: ' + r.error;
        return;
      }

      status.textContent = 'Summary ready';
      output.value = r.summary || '';
    } catch (err) {
      status.textContent = 'Extension error: ' + (err && err.message ? err.message : String(err));
    }
  });
});
