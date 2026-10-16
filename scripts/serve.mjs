import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../docs/', import.meta.url));
const mime = { '.html': 'text/html; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

export function createStaticServer() {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://localhost');
      // Serve the same project subpath used on GitHub Pages.
      let pathname = decodeURIComponent(url.pathname).replace(/^\/dinosaur-game(?=\/|$)/, '');
      if (pathname.endsWith('/') || !pathname) pathname += 'index.html';
      const target = resolve(root, '.' + pathname);
      if (!target.startsWith(resolve(root) + sep) || !(await stat(target)).isFile()) throw new Error('Not found');
      const body = await readFile(target);
      response.writeHead(200, { 'Content-Type': mime[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'Content-Length': body.length });
      response.end(request.method === 'HEAD' ? undefined : body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createStaticServer();
  const port = Number(process.env.PORT || 4173);
  server.listen(port, '127.0.0.1', () => console.log(`Диносчёт: http://127.0.0.1:${port}/dinosaur-game/`));
}
