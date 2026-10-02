// Servidor estático para testar o site localmente: node scripts/servidor-local.mjs [porta]
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const PORTA = Number(process.argv[2] || 8765);
const TIPOS = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
};

http.createServer(async (req, res) => {
    const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const arquivo = normalize(join(RAIZ, caminho === '/' ? 'index.html' : caminho));
    if (!arquivo.startsWith(normalize(RAIZ))) {
        res.writeHead(403).end();
        return;
    }
    try {
        const corpo = await readFile(arquivo);
        res.writeHead(200, { 'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
        res.end(corpo);
    } catch {
        res.writeHead(404).end('Não encontrado');
    }
}).listen(PORTA, () => console.log(`Servindo ${RAIZ} em http://localhost:${PORTA}`));
