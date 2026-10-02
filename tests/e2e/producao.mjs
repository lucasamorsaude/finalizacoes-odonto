// Verificação somente leitura do site publicado (nada é gravado).
// Uso: cd tests && node e2e/producao.mjs
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { chromium } from 'playwright-core';

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
const BASE = 'https://lucasamorsaude.github.io/finalizacoes-odonto/';
const erros = [];
const navegador = await chromium.launch({ channel: 'msedge', headless: true });
const pagina = await (await navegador.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
pagina.on('pageerror', e => erros.push(e.message));
pagina.on('console', m => m.type() === 'error' && erros.push(m.text()));
const ok = (cond, msg) => console.log(`  ${cond ? '✔' : '✘'} ${msg}`);

let t = Date.now();
await pagina.goto(BASE);
await pagina.waitForSelector('#profissional:not([disabled])');
ok(true, `formulário pronto em ${Date.now() - t} ms`);

await pagina.goto(`${BASE}dashboard.html`);
await pagina.waitForURL(/login\.html/);
ok(true, 'endereço antigo dashboard.html leva ao login');

await pagina.fill('#usuario', process.env.E2E_ADMIN_USUARIO);
await pagina.fill('#senha', process.env.E2E_ADMIN_SENHA);
t = Date.now();
await pagina.click('#entrar');
await pagina.waitForSelector('.linha[data-id]');
ok(true, `login → fila em ${Date.now() - t} ms · ${await pagina.textContent('#contagem')}`);

await pagina.locator('[data-acao="finalizar"]').first().click();
await pagina.waitForSelector('.modal:has-text("Finalizar procedimento")');
ok(true, 'Finalizar abre a confirmação');
await pagina.keyboard.press('Escape');

for (const tela of ['painel.html', 'desempenho.html', 'registros.html', 'usuarios.html']) {
    t = Date.now();
    await pagina.goto(BASE + tela);
    await pagina.waitForSelector('main.conteudo:not([hidden])');
    await pagina.waitForLoadState('networkidle');
    ok(true, `${tela} em ${Date.now() - t} ms`);
}
ok(!erros.length, `sem erros de console${erros.length ? ': ' + erros.join(' | ') : ''}`);
await navegador.close();
