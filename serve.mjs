/*
 * Static dev server for Ideology Studio.
 *
 * Needed because the pages must be served over http, not opened as file://.
 * Under file:// the browser gives every file its own opaque origin, which
 * blocks localStorage entirely — the whole persistence layer would silently
 * do nothing, and the app would look like it simply refuses to save.
 *
 * Zero dependencies, Node's own http module. Run:  node serve.mjs
 */

import { createServer } from 'node:http';
import { readFile, stat, open as openFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const PORT = Number(process.env.PORT) || 4321;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.js':   'text/javascript; charset=utf-8',
  '.mjs':  'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.webp': 'image/webp',
  '.mp4':  'video/mp4',
  '.webm': 'video/webm',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
};

/* Friendly entry points, so nobody has to remember the folder layout. */
const ROUTES = {
  '/':        '/src/pages/studio/index.html',
  '/studio':  '/src/pages/studio/index.html',
  '/client':  '/src/pages/client/index.html',
};

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let pathname = decodeURIComponent(url.pathname);

    if (ROUTES[pathname]) pathname = ROUTES[pathname];

    // Contain the path inside ROOT. normalize() collapses "..", and the
    // startsWith check rejects anything that still escapes — without it,
    // a request for /../../.env would be served happily.
    const filePath = join(ROOT, normalize(pathname));
    if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) {
      res.writeHead(403).end('Forbidden');
      return;
    }

    const info = await stat(filePath).catch(() => null);
    if (!info || info.isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`<pre style="font:14px ui-monospace;padding:24px">404 ${pathname}

Ideology Studio
  studio  http://localhost:${PORT}/
  portale http://localhost:${PORT}/client?t=mf7c21a8b309
</pre>`);
      return;
    }

    const type = TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
    // No caching in dev: an edit must show up on reload, and a cached 780KB
    // bundle is exactly the kind of thing that wastes an hour debugging a fix
    // that already worked.
    const base = { 'Content-Type': type, 'Cache-Control': 'no-store' };

    /* Range requests. A <video> element cannot seek without them: it asks for
       a byte range and a server that always answers 200 with the whole file
       gives a clip that plays from the start and refuses to scrub. */
    const range = req.headers.range;
    if (range && /^bytes=/.test(range)) {
      const [rawStart, rawEnd] = range.replace('bytes=', '').split('-');
      const start = rawStart ? parseInt(rawStart, 10) : 0;
      const end = rawEnd ? parseInt(rawEnd, 10) : info.size - 1;

      if (isNaN(start) || isNaN(end) || start > end || end >= info.size) {
        res.writeHead(416, { 'Content-Range': `bytes */${info.size}` }).end();
        return;
      }
      const fh = await openFile(filePath, 'r');
      const buf = Buffer.alloc(end - start + 1);
      await fh.read(buf, 0, buf.length, start);
      await fh.close();
      res.writeHead(206, Object.assign({}, base, {
        'Content-Range': `bytes ${start}-${end}/${info.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': buf.length,
      }));
      res.end(buf);
      return;
    }

    const body = await readFile(filePath);
    res.writeHead(200, Object.assign({}, base, {
      'Accept-Ranges': 'bytes',
      'Content-Length': body.length,
    }));
    res.end(body);
  } catch (err) {
    res.writeHead(500).end('Server error: ' + err.message);
  }
}).listen(PORT, () => {
  const demo = 'mf7c21a8b309';
  console.log(`
  Ideology Studio — server locale

    Studio    http://localhost:${PORT}/
    Portale   http://localhost:${PORT}/client?t=${demo}   (Marefuori)

  Ctrl+C per fermare.
`);
});
