# Hello World Chrome Extension

This is a minimal Chrome extension that shows a "Hello, world!" message when you click the extension icon.

Files added:
- `manifest.json` - extension manifest (manifest v3)
- `icons/icon.svg` - toolbar icon
- `popup.html` - the popup shown when clicking the icon
- `popup.js` - small script for the popup

How to load locally in Chrome (Windows):

1. Open Chrome and go to chrome://extensions
2. Enable "Developer mode" (top-right)
3. Click "Load unpacked"
4. Select the folder: `c:\Users\sgao1\Desktop\chrome-ai-summarizer`
5. The extension will appear in the toolbar. Click its icon to see "Hello, world!".

Notes:
- The icon is an SVG file included in `icons/icon.svg`. If you prefer PNG icons, replace the file and update `manifest.json` accordingly.

Updated: AI Summarizer

This extension now uses the Chrome built-in Summarizer API to summarize the visible text on the current page (the `innerText` of `document.body`).

How it works
- When you click the extension icon, the popup appears. Click "Summarize page".
- The popup injects a small script into the active tab that:
	- checks for the Summarizer API and model availability,
	- creates a Summarizer instance (which may trigger a model download on first use), and
	- calls `summarizer.summarize(document.body.innerText, {context: 'Summarize the visible text of this page.'})`.
- The resulting summary is returned to the popup and shown in the output box.

Requirements & notes
- Chrome 138+ and a supported desktop OS (Windows 10/11, macOS 13+, Linux). The Summarizer API may require the built-in model (Gemini Nano) to be downloaded; the first use can take time depending on your device and connection.
- The Summarizer API is only available in top-level pages and same-origin iframes. It is not available in extension pages — which is why the summarization runs inside the page context (via `chrome.scripting.executeScript`).
- If you see "Summarizer API not available" or model-unavailable messages, confirm your Chrome version and device meets the documented requirements.

Privacy & safety
- The summarization runs locally on the user's device using Chrome's built-in models where available; no content is sent to external servers by this extension.

If you'd like, I can:
- Add UI options for summary type (tldr/key-points/teaser/headline) and length (short/medium/long).
- Add a streaming summary view (progressively update output as chunks arrive).
- Provide PNG icons in multiple sizes and bump version again.
