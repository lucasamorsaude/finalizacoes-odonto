// Testes e2e de fumaça (gate da constituição antes do merge na main).
// Uso: cd tests && npm install && npm run e2e
// Requer no ../.env: DATABASE_URL, DATABASE_PUBLISH_KEY, SUPABASE_SECRET_KEY, E2E_ADMIN_USUARIO, E2E_ADMIN_SENHA.
// Cria um profissional e registros temporários e apaga tudo ao final, mesmo em caso de falha.
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { chromium } from 'playwright-core';
import { createClient } from '@supabase/supabase-js';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
dotenv.config({ path: `${RAIZ}.env`, quiet: true });

const PORTA = 8799;
const BASE = `http://localhost:${PORTA}/`;
const CAPTURAS = fileURLToPath(new URL('../capturas/', import.meta.url));
mkdirSync(CAPTURAS, { recursive: true });

const PROF = 'Profissional Teste E2E';
const LOGIN_PROF = 'teste.e2e';
const SENHA_PROF = 'e2e-senha-123';
const ADMIN = { usuario: process.env.E2E_ADMIN_USUARIO, senha: process.env.E2E_ADMIN_SENHA };
const PACIENTES = ['E2E Paciente Ana', 'E2E Paciente Bruno', 'E2E Paciente Carla', 'E2E Paciente Dora'];

const opcoes = { auth: { persistSession: false } };
const secreto = createClient(process.env.DATABASE_URL, process.env.SUPABASE_SECRET_KEY, opcoes);
const publico = () => createClient(process.env.DATABASE_URL, process.env.DATABASE_PUBLISH_KEY, opcoes);

const resultados = [];
const errosConsole = [];
let servidor;
let navegador;

async function cenario(nome, fn) {
    const inicio = Date.now();
    try {
        const detalhe = await fn();
        resultados.push({ nome, ok: true, ms: Date.now() - inicio, detalhe });
        console.log(`  ✔ ${nome}${detalhe ? ` — ${detalhe}` : ''}`);
    } catch (erro) {
        resultados.push({ nome, ok: false, detalhe: erro.message });
        console.log(`  ✘ ${nome} — ${erro.message}`);
        throw erro;
    }
}

function afirmar(condicao, mensagem) {
    if (!condicao) throw new Error(mensagem);
}

async function novaPagina({ largura = 1440, altura = 900, esquema = 'light' } = {}) {
    const contexto = await navegador.newContext({
        viewport: { width: largura, height: altura }, colorScheme: esquema,
        permissions: ['clipboard-read', 'clipboard-write'],
    });
    const pagina = await contexto.newPage();
    pagina.on('pageerror', e => errosConsole.push(`${pagina.url()}: ${e.message}`));
    pagina.on('console', m => {
        // 400 do login com senha errada é esperado em outros fluxos; aqui não há
        if (m.type() === 'error') errosConsole.push(`${pagina.url()}: ${m.text()}`);
    });
    return pagina;
}

async function entrar(pagina, usuario, senha) {
    await pagina.goto(`${BASE}login.html`);
    await pagina.fill('#usuario', usuario);
    await pagina.fill('#senha', senha);
    await pagina.click('#entrar');
    await pagina.waitForURL(/fila\.html/);
}

async function registrosTemporarios() {
    const { data } = await secreto.from('finalizacoes').select('id, paciente, status, observacao, finalizado_em')
        .eq('profissional', PROF).order('id');
    return data ?? [];
}

async function limpar() {
    const { data: usuario } = await secreto.from('usuarios').select('id').eq('username', LOGIN_PROF).maybeSingle();
    await secreto.from('finalizacoes').delete().eq('profissional', PROF);
    if (usuario) await secreto.auth.admin.deleteUser(usuario.id);
}

async function principal() {
    servidor = spawn(process.execPath, [`${RAIZ}scripts/servidor-local.mjs`, String(PORTA)], { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 600));
    navegador = await chromium.launch({ channel: 'msedge', headless: true });

    await limpar(); // resíduo de execução anterior interrompida

    // Profissional temporário criado pela Edge Function, como o painel admin faz
    const adminApi = publico();
    await adminApi.auth.signInWithPassword({ email: `${ADMIN.usuario}@finalizacoes.local`, password: `odonto:${ADMIN.senha}` });
    const criado = await adminApi.functions.invoke('admin-usuarios', {
        body: { acao: 'criar', username: LOGIN_PROF, senha: SENHA_PROF, profissional: PROF, unidade: 'SJDR' },
    });
    afirmar(!criado.error, 'falha ao criar profissional temporário');

    console.log('\nCenários:');

    await cenario('1. Formulário público registra e lembra unidade/profissional', async () => {
        const p = await novaPagina();
        await p.goto(BASE);
        await p.waitForSelector('#profissional:not([disabled])');
        await p.selectOption('#unidade', 'SJDR');
        await p.selectOption('#profissional', PROF);
        for (const nome of PACIENTES.slice(0, 3)) {
            await p.fill('#paciente', nome);
            await p.fill('#procedimento', 'Procedimento de teste automatizado');
            await p.click('#registrar');
            await p.waitForFunction(n => document.querySelector('#mensagem')?.textContent.includes(n), nome);
        }
        afirmar(await p.inputValue('#unidade') === 'SJDR' && await p.inputValue('#profissional') === PROF, 'não lembrou unidade/profissional');
        afirmar(await p.inputValue('#paciente') === '', 'paciente não foi limpo');
        await p.goto(BASE);
        await p.waitForSelector('#profissional:not([disabled])');
        afirmar(await p.inputValue('#profissional') === PROF, 'não lembrou após recarregar');
        await p.screenshot({ path: `${CAPTURAS}formulario.png` });
        afirmar((await registrosTemporarios()).length === 3, 'esperava 3 registros');
        await p.context().close();
        return '3 registros';
    });

    const admin = await novaPagina();

    await cenario('2. Admin entra e cai na fila em menos de 2 s', async () => {
        await admin.goto(`${BASE}login.html`);
        await admin.fill('#usuario', ADMIN.usuario);
        await admin.fill('#senha', ADMIN.senha);
        const inicio = Date.now();
        await admin.click('#entrar');
        await admin.waitForSelector('.linha[data-id]');
        const ms = Date.now() - inicio;
        afirmar(ms < 2000, `fila levou ${ms} ms`);
        await admin.screenshot({ path: `${CAPTURAS}fila-admin.png` });
        await admin.goto(`${BASE}fila.html?profissional=${encodeURIComponent(PROF)}`);
        await admin.waitForFunction(() => document.querySelectorAll('.linha[data-id]').length === 3);
        return `${ms} ms`;
    });

    const linhaDe = nome => admin.locator('.linha[data-id]', { hasText: nome });

    await cenario('3. Clicar no nome copia o paciente', async () => {
        await linhaDe(PACIENTES[0]).locator('.copiavel').click();
        const copiado = await admin.evaluate(() => navigator.clipboard.readText());
        afirmar(copiado === PACIENTES[0], `copiou "${copiado}"`);
    });

    await cenario('4. Finalizar com um clique e desfazer', async () => {
        await linhaDe(PACIENTES[0]).locator('[data-acao="finalizar"]').click();
        await linhaDe(PACIENTES[0]).waitFor({ state: 'detached' });
        await admin.click('.toast button:has-text("Desfazer")');
        await linhaDe(PACIENTES[0]).waitFor();
        const [ana] = await registrosTemporarios();
        const { data: eventos } = await secreto.from('finalizacao_eventos').select('status_para').eq('finalizacao_id', ana.id).order('em');
        afirmar(ana.status === 'Pendente', `status ficou ${ana.status}`);
        afirmar(eventos.map(e => e.status_para).join(',') === 'Finalizado,Pendente', `eventos: ${eventos.map(e => e.status_para)}`);
        return 'histórico com 2 eventos';
    });

    await cenario('5. Recusar exige motivo e tira da fila', async () => {
        await linhaDe(PACIENTES[1]).locator('[data-acao="detalhe"]').click();
        await admin.check('input[name="status"][value="Recusado"]');
        await admin.click('.modal button[type="submit"]');
        afirmar(await admin.isVisible('#detalhe-obs-erro'), 'não exigiu motivo');
        await admin.fill('#detalhe-obs', 'Fora do prazo de 6 meses (teste)');
        await admin.click('.modal button[type="submit"]');
        await linhaDe(PACIENTES[1]).waitFor({ state: 'detached' });
        const bruno = (await registrosTemporarios()).find(r => r.paciente === PACIENTES[1]);
        afirmar(bruno.status === 'Recusado' && bruno.observacao, 'não ficou recusado com motivo');
    });

    await cenario('6. Finalizar em lote', async () => {
        await linhaDe(PACIENTES[0]).locator('[data-sel]').check();
        await linhaDe(PACIENTES[2]).locator('[data-sel]').check();
        afirmar((await admin.textContent('#lote-qtd')).includes('2'), 'barra de lote não mostra 2');
        await admin.click('#lote-finalizar');
        await admin.waitForFunction(() => !document.querySelector('.linha[data-id]'));
        const finalizados = (await registrosTemporarios()).filter(r => r.status === 'Finalizado' && r.finalizado_em);
        afirmar(finalizados.length === 2, `finalizados com data: ${finalizados.length}`);
        await admin.screenshot({ path: `${CAPTURAS}fila-zerada.png` });
    });

    const dentista = await novaPagina();

    await cenario('7. Dentista registra pelo sistema e vê só os seus, sem ações', async () => {
        await entrar(dentista, LOGIN_PROF, SENHA_PROF);
        await dentista.click('.lateral [data-nova-finalizacao]');
        afirmar(!(await dentista.isVisible('#nova-profissional')), 'dentista não deveria escolher profissional');
        await dentista.selectOption('#nova-unidade', 'SJDR');
        await dentista.fill('#nova-paciente', PACIENTES[3]);
        await dentista.fill('#nova-procedimento', 'Registro pelo sistema (teste)');
        await dentista.click('.modal button[type="submit"]');
        await dentista.locator('.linha[data-id]', { hasText: PACIENTES[3] }).waitFor();
        const linhas = await dentista.locator('#lista .linha[data-id]').count();
        afirmar(linhas === 1, `dentista vê ${linhas} itens abertos`);
        afirmar(await dentista.locator('[data-acao="finalizar"], [data-sel]').count() === 0, 'dentista tem controles de admin');
        await dentista.locator('#secao-recusados .linha', { hasText: PACIENTES[1] }).waitFor();
        afirmar(await dentista.isVisible('text=Fora do prazo de 6 meses (teste)'), 'motivo da recusa não aparece');
        await dentista.screenshot({ path: `${CAPTURAS}fila-dentista.png`, fullPage: true });
        const dora = (await registrosTemporarios()).find(r => r.paciente === PACIENTES[3]);
        afirmar(dora, 'registro do dentista não gravado com o nome dele');
    });

    await cenario('8. Banco recusa alteração de status pelo dentista', async () => {
        const api = publico();
        await api.auth.signInWithPassword({ email: `${LOGIN_PROF}@finalizacoes.local`, password: `odonto:${SENHA_PROF}` });
        const alvo = (await registrosTemporarios()).find(r => r.paciente === PACIENTES[3]);
        const { data } = await api.from('finalizacoes').update({ status: 'Finalizado' }).eq('id', alvo.id).select('id');
        afirmar(!data?.length, 'dentista conseguiu alterar');
        const { data: outros } = await api.from('finalizacoes').select('profissional').neq('profissional', PROF).limit(1);
        afirmar(!outros?.length, 'dentista vê registros de outros');
    });

    await cenario('9. Dentista não acessa desempenho', async () => {
        await dentista.goto(`${BASE}desempenho.html`);
        await dentista.waitForURL(/fila\.html/);
        const api = publico();
        await api.auth.signInWithPassword({ email: `${LOGIN_PROF}@finalizacoes.local`, password: `odonto:${SENHA_PROF}` });
        const { error } = await api.rpc('desempenho_profissionais', { p_de: new Date(0).toISOString(), p_ate: new Date().toISOString() });
        afirmar(error, 'RPC de desempenho deveria falhar');
    });

    await cenario('10. Painel e desempenho coerentes com o banco', async () => {
        await admin.goto(`${BASE}painel.html`);
        await admin.waitForSelector('#kpis .kpi');
        await admin.waitForSelector('#grafico-serie svg');
        await admin.screenshot({ path: `${CAPTURAS}painel.png`, fullPage: true });
        const recebidosTela = (await admin.locator('#kpis .kpi').first().locator('.valor').textContent()).replace(/\D/g, '');

        const amanha = new Date(`${new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10)}T00:00:00-03:00`).getTime() + 86400000;
        const { count } = await secreto.from('finalizacoes').select('id', { count: 'exact', head: true })
            .gte('created_at', new Date(amanha - 30 * 86400000).toISOString()).lt('created_at', new Date(amanha).toISOString());
        afirmar(Number(recebidosTela) === count, `painel ${recebidosTela} × banco ${count}`);

        const abertoTela = (await admin.textContent('#aberto-total')).replace(/\D/g, '');
        const { count: abertos } = await secreto.from('finalizacoes').select('id', { count: 'exact', head: true })
            .in('status', ['Pendente', 'Aguardando liberação', 'Aguardando pagamento']);
        afirmar(Number(abertoTela) === abertos, `em aberto ${abertoTela} × banco ${abertos}`);

        await admin.goto(`${BASE}desempenho.html`);
        await admin.waitForSelector('#tabela tbody tr');
        const linha = admin.locator('#tabela tbody tr', { hasText: PROF });
        const recebidosProf = await linha.locator('td').nth(1).textContent();
        afirmar(recebidosProf.trim() === '4', `desempenho mostra ${recebidosProf} recebidos`);
        await admin.screenshot({ path: `${CAPTURAS}desempenho.png`, fullPage: true });
        await linha.locator('[data-evolucao]').click();
        await admin.waitForSelector('#grafico-evolucao svg');
        await admin.keyboard.press('Escape');
        return `recebidos 30d = ${count}, abertos = ${abertos}`;
    });

    await cenario('11. Todas as telas em 360 px e no modo escuro, sem erros', async () => {
        const telas = ['fila.html', 'painel.html', 'desempenho.html', 'registros.html', 'usuarios.html'];
        const movel = await novaPagina({ largura: 360, altura: 780 });
        await movel.goto(BASE);
        await movel.waitForSelector('#profissional:not([disabled])');
        const larguras = { 'index.html': await movel.evaluate(() => document.documentElement.scrollWidth) };
        await movel.screenshot({ path: `${CAPTURAS}movel-index.png` });
        await movel.goto(`${BASE}login.html`);
        larguras['login.html'] = await movel.evaluate(() => document.documentElement.scrollWidth);
        await entrar(movel, ADMIN.usuario, ADMIN.senha);
        for (const tela of telas) {
            await movel.goto(BASE + tela);
            await movel.waitForSelector('main.conteudo:not([hidden])');
            await movel.waitForLoadState('networkidle');
            larguras[tela] = await movel.evaluate(() => document.documentElement.scrollWidth);
            await movel.screenshot({ path: `${CAPTURAS}movel-${tela.replace('.html', '')}.png` });
        }
        const largas = Object.entries(larguras).filter(([, l]) => l > 360);
        afirmar(!largas.length, `rolagem horizontal: ${JSON.stringify(largas)}`);

        const escuro = await novaPagina({ esquema: 'dark' });
        await entrar(escuro, ADMIN.usuario, ADMIN.senha);
        for (const tela of telas) {
            await escuro.goto(BASE + tela);
            await escuro.waitForSelector('main.conteudo:not([hidden])');
            await escuro.waitForLoadState('networkidle');
            await escuro.screenshot({ path: `${CAPTURAS}escuro-${tela.replace('.html', '')}.png` });
        }
        afirmar(!errosConsole.length, `erros de console: ${errosConsole.join(' | ')}`);
        return '7 telas';
    });
}

try {
    await principal();
} catch {
    // falha já registrada no cenário
} finally {
    await limpar();
    const residuo = await registrosTemporarios();
    const { data: usuarioResto } = await secreto.from('usuarios').select('id').eq('username', LOGIN_PROF);
    const limpo = !residuo.length && !usuarioResto?.length;
    resultados.push({ nome: '12. Limpeza', ok: limpo });
    console.log(`  ${limpo ? '✔' : '✘'} 12. Limpeza — ${limpo ? 'sem resíduos' : 'restaram dados de teste'}`);
    await navegador?.close();
    servidor?.kill();
    const falhas = resultados.filter(r => !r.ok).length;
    console.log(`\n${resultados.length - falhas}/${resultados.length} cenários ok. Capturas em tests/capturas/`);
    process.exit(falhas ? 1 : 0);
}
