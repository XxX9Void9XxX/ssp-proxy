import express from 'express';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Serve static files (your SSP browser HTML, CSS, JS)
app.use(express.static(path.join(__dirname, 'public')));

// Minimal safe proxy endpoint
app.get('/proxy', async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).send('No URL specified');

  try {
    const response = await fetch(url);
    let body = await response.text();

    // Rewrite relative links and sources
    body = body.replace(/(href|src)=["'](?!http)([^"']+)["']/g, (match, attr, value) => {
      const newURL = new URL(value, url).href;
      return `${attr}="/proxy?url=${encodeURIComponent(newURL)}"`;
    });

    res.send(body);
  } catch (err) {
    res.status(500).send('Error fetching URL: ' + err.message);
  }
});

// Use Render's PORT environment variable
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`SSP Proxy running on port ${PORT}`));
