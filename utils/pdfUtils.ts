/**
 * Utility functions for in-memory PDF handling and viewer generation
 */

/**
 * Converts an ArrayBuffer to a Base64 string in memory with chunking
 * to avoid stack overflow issues on large PDF files.
 */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const len = bytes.byteLength;
  const chunkSize = 8192;

  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, len));
    let chunkString = '';
    for (let j = 0; j < chunk.length; j++) {
      chunkString += String.fromCharCode(chunk[j]);
    }
    binary += chunkString;
  }

  if (typeof btoa !== 'undefined') {
    return btoa(binary);
  }

  // Node/Fallback buffer conversion if btoa is unavailable
  if (typeof (globalThis as any).Buffer !== 'undefined') {
    return (globalThis as any).Buffer.from(binary, 'binary').toString('base64');
  }
  return '';
}

/**
 * Generates an in-memory HTML document that renders the base64-encoded PDF
 * using Mozilla PDF.js with high DPI vector clarity and interactive pinch-to-zoom.
 */
export function generatePdfViewerHtml(base64Data: string, title: string = 'Document'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=4.0, user-scalable=yes">
  <title>${escapeHtml(title)}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }
    html, body {
      background-color: #0f172a;
      min-height: 100%;
      width: 100%;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow-x: hidden;
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
    }
    #pdf-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 8px 32px 8px;
      gap: 16px;
      width: 100%;
    }
    .page-card {
      position: relative;
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), 0 8px 10px -6px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      max-width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      transition: transform 0.2s ease;
    }
    canvas {
      display: block;
      width: 100% !important;
      height: auto !important;
    }
    .page-badge {
      position: absolute;
      bottom: 8px;
      right: 10px;
      background: rgba(15, 23, 42, 0.75);
      color: #f8fafc;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      pointer-events: none;
      backdrop-filter: blur(4px);
      letter-spacing: 0.5px;
    }
    #loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 70vh;
      color: #94a3b8;
      text-align: center;
      padding: 24px;
    }
    .spinner {
      width: 44px;
      height: 44px;
      border: 3.5px solid rgba(148, 163, 184, 0.2);
      border-top-color: #6366f1;
      border-radius: 50%;
      animation: spin 0.8s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      margin-bottom: 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .loading-text {
      font-size: 15px;
      font-weight: 500;
      color: #e2e8f0;
      margin-bottom: 6px;
    }
    .loading-sub {
      font-size: 12px;
      color: #64748b;
    }
    #error-state {
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 60vh;
      color: #f87171;
      padding: 24px;
      text-align: center;
    }
    .error-box {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      padding: 16px 20px;
      border-radius: 12px;
      font-size: 13px;
      max-width: 90%;
      line-height: 1.5;
    }
  </style>
</head>
<body>
  <div id="loading-state">
    <div class="spinner"></div>
    <div class="loading-text">Rendering PDF Document</div>
    <div class="loading-sub">Loading document in memory...</div>
  </div>

  <div id="error-state">
    <div class="error-box" id="error-message">Failed to render PDF document.</div>
  </div>

  <div id="pdf-container"></div>

  <script>
    function post(data) {
      if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
        window.ReactNativeWebView.postMessage(JSON.stringify(data));
      }
    }

    try {
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js library could not be loaded.');
      }

      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      const base64Data = "${base64Data}";
      const raw = atob(base64Data);
      const rawLength = raw.length;
      const array = new Uint8Array(new ArrayBuffer(rawLength));

      for (let i = 0; i < rawLength; i++) {
        array[i] = raw.charCodeAt(i);
      }

      const loadingTask = pdfjsLib.getDocument({
        data: array,
        cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/',
        cMapPacked: true
      });

      loadingTask.promise.then(async function(pdf) {
        document.getElementById('loading-state').style.display = 'none';
        const container = document.getElementById('pdf-container');
        const numPages = pdf.numPages;

        post({ type: 'STATUS', status: 'READY', totalPages: numPages });

        const dpr = Math.min(window.devicePixelRatio || 2, 3);

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          // Scale 1.5 - 2.0 provides ultra crisp vector rendering on retina mobile screens
          const viewport = page.getViewport({ scale: dpr });

          const card = document.createElement('div');
          card.className = 'page-card';
          card.id = 'page-' + pageNum;

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d', { alpha: false });
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          card.appendChild(canvas);

          if (numPages > 1) {
            const badge = document.createElement('div');
            badge.className = 'page-badge';
            badge.textContent = pageNum + ' / ' + numPages;
            card.appendChild(badge);
          }

          container.appendChild(card);

          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;
        }

        post({ type: 'STATUS', status: 'COMPLETED' });
      }).catch(function(err) {
        document.getElementById('loading-state').style.display = 'none';
        const errDiv = document.getElementById('error-state');
        errDiv.style.display = 'flex';
        document.getElementById('error-message').textContent = 'PDF Render Error: ' + (err.message || 'Unknown error');
        post({ type: 'ERROR', message: err.message || 'Unknown render error' });
      });
    } catch (e) {
      document.getElementById('loading-state').style.display = 'none';
      const errDiv = document.getElementById('error-state');
      errDiv.style.display = 'flex';
      document.getElementById('error-message').textContent = 'Initialization Error: ' + (e.message || 'Unknown error');
      post({ type: 'ERROR', message: e.message || 'Init error' });
    }
  </script>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
