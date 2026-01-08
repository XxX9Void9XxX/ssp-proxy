import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.static(path.join(__dirname, 'public')));

// In-memory history for back/forward (per session simplified)
const historyMap = {};

// Proxy endpoint
app.get('/proxy', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('No URL specified');

  try {
    const response = await fetch(url);
    let body = await response.text();

    // Rewrite all href, src, form actions to go through proxy
    body = body.replace(/(href|src|action)=["'](?!http)([^"']+)["']/g, (match, attr, value) => {
      const newURL = new URL(value, url).href;
      return `${attr}="/proxy?url=${encodeURIComponent(newURL)}"`;
    });

    // Inject JS to rewrite fetch/XHR and history
    const injectedScript = `
      <script>
      const originalFetch = window.fetch;
      window.fetch = (...args) => {
        if(typeof args[0] === 'string' && !args[0].startsWith('/proxy')) {
          args[0] = '/proxy?url=' + encodeURIComponent(args[0]);
        }
        return originalFetch(...args);
      };

      const openInProxy = url => window.location.href='/proxy?url='+encodeURIComponent(url);

      const pushState = history.pushState;
      history.pushState = function(state, title, url){
        if(url) openInProxy(url);
        pushState.apply(history, arguments);
      };

      const replaceState = history.replaceState;
      history.replaceState = function(state,title,url){
        if(url) openInProxy(url);
        replaceState.apply(history, arguments);
      };
      </script>
    `;
    body = body.replace('</head>', injectedScript + '</head>');

    res.send(body);
  } catch (err) {
    res.status(500).send('Error fetching URL: ' + err.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SSP Proxy running on port ${PORT}`));
