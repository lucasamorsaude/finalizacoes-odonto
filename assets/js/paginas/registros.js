// Consulta completa de registros: filtros, paginação, detalhe com histórico e exportação (admin).
import { iniciarApp } from '../app.js';
import { sb, STATUS_TODOS, UNIDADES } from '../supabase.js';
import { icone } from '../icones.js';
import {
    esc, dataHora, chipStatus, classeStatus, nomeCopiavel, numero, toast, esqueletoLinhas, vazio, falha, debounce,
    lerParametros, gravarParametros, preencherSelect, intervaloDeDatas, mensagemErro, aplicarIcones,
    ativarFiltrosMoveis, botaoCarregando,
} from '../ui.js';
import { abrirDetalhe } from '../detalhe.js';

aplicarIcones();
ativarFiltrosMoveis(document.getElementById('mostrar-filtros'), document.getElementById('filtros'));
const perfil = await iniciarApp({ tela: 'registros' });
const admin = perfil.is_admin;

const POR_PAGINA = 50;
const COLUNAS = 'id, unidade, paciente, procedimento, profissional, status, observacao, created_at, updated_at';
const $ = id => document.getElementById(id);
const el = {
    busca: $('f-busca'), unidade: $('f-unidade'), profissional: $('f-profissional'), de: $('f-de'), ate: $('f-ate'),
    resumo: $('resumo'), lista: $('lista'), contagem: $('contagem'), anterior: $('anterior'), proxima: $('proxima'),
};

const params = lerParametros();
let pagina = 0;
let total = 0;
let itens = [];
let status = STATUS_TODOS.includes(params.status) ? params.status : '';
let primeiraCarga = true;

preencherSelect(el.unidade, UNIDADES, { vazio: 'Todas', valor: params.unidade ?? '' });
el.busca.value = params.busca ?? '';
el.de.value = params.de ?? '';
el.ate.value = params.ate ?? '';

if (admin) {
    $('campo-profissional').hidden = false;
    $('exportar').hidden = false;
    el.lista.style.setProperty('--colunas', '112px minmax(0, 1fr) 190px 96px 196px');
    el.lista.style.setProperty('--areas-movel', '"pac pac pac" "prof prof prof" "data uni uni" "status status status"');
    const { data } = await sb.rpc('profissionais_registrados');
    preencherSelect(el.profissional, data ?? [], { vazio: 'Todos', valor: params.profissional ?? '' });
} else {
    $('descricao').textContent = 'Todos os seus procedimentos registrados, em qualquer situação.';
    el.lista.style.setProperty('--colunas', '112px minmax(0, 1fr) 96px 196px');
    el.lista.style.setProperty('--areas-movel', '"pac pac pac" "data uni uni" "status status status"');
}

function filtrosAtuais() {
    const { de, ate } = intervaloDeDatas(el.de.value, el.ate.value);
    return {
        unidade: el.unidade.value || null,
        profissional: admin ? (el.profissional.value || null) : null,
        busca: el.busca.value.trim() || null,
        de, ate,
    };
}

function montarConsulta(f, { comStatus = true } = {}) {
    let consulta = sb.from('finalizacoes').select(COLUNAS, { count: 'exact' });
    if (comStatus && status) consulta = consulta.eq('status', status);
    if (f.unidade) consulta = consulta.eq('unidade', f.unidade);
    if (f.profissional) consulta = consulta.eq('profissional', f.profissional);
    if (f.busca) consulta = consulta.ilike('paciente', `%${f.busca}%`);
    if (f.de) consulta = consulta.gte('created_at', f.de);
    if (f.ate) consulta = consulta.lt('created_at', f.ate);
    return consulta.order('created_at', { ascending: false }).order('id', { ascending: false });
}

async function carregar({ manterPagina = false } = {}) {
    if (!manterPagina) pagina = 0;
    const f = filtrosAtuais();
    gravarParametros({
        busca: f.busca, unidade: f.unidade, profissional: f.profissional, status,
        de: el.de.value, ate: el.ate.value, id: params.id,
    });

    if (primeiraCarga) el.lista.innerHTML = esqueletoLinhas(10);
    else el.lista.classList.add('recarregando');

    const [lista, resumo] = await Promise.all([
        montarConsulta(f).range(pagina * POR_PAGINA, pagina * POR_PAGINA + POR_PAGINA - 1),
        sb.rpc('resumo_status', {
            p_unidade: f.unidade, p_profissional: f.profissional, p_paciente: f.busca, p_de: f.de, p_ate: f.ate,
        }),
    ]);
    el.lista.classList.remove('recarregando');

    if (lista.error) {
        if (primeiraCarga) el.lista.innerHTML = falha(mensagemErro(lista.error));
        else toast(mensagemErro(lista.error), { tipo: 'erro' });
        return;
    }
    primeiraCarga = false;
    itens = lista.data;
    total = lista.count ?? 0;
    renderizarResumo(resumo.data ?? []);
    renderizar();
}

function renderizarResumo(dados) {
    const porStatus = Object.fromEntries(dados.map(r => [r.status, Number(r.total)]));
    const todos = dados.reduce((s, r) => s + Number(r.total), 0);
    el.resumo.innerHTML = [['', 'Todos', todos], ...STATUS_TODOS.map(s => [s, s, porStatus[s] ?? 0])]
        .map(([valor, rotulo, qtd]) => `
            <button type="button" class="${classeStatus(valor)}" data-status="${esc(valor)}" aria-pressed="${status === valor}">
                ${esc(rotulo)} <strong class="num">${numero(qtd)}</strong>
            </button>`).join('');
}

function renderizar() {
    if (!itens.length) {
        el.lista.innerHTML = vazio({ icone: 'busca', titulo: 'Nenhum registro encontrado', texto: 'Ajuste os filtros para ver outros registros.' });
    } else {
        el.lista.innerHTML = `
            <div class="lista__cab" aria-hidden="true">
                <div>Registrado</div><div>Paciente / procedimento</div>${admin ? '<div>Profissional</div>' : ''}<div>Unidade</div><div>Status</div>
            </div>
            <div role="list">${itens.map(item => `
                <div class="linha clicavel" role="listitem" tabindex="0" data-id="${item.id}">
                    <div class="a-data texto-2 pequeno">${dataHora(item.created_at)}</div>
                    <div class="celula-paciente a-pac">
                        ${nomeCopiavel(item.paciente)}
                        <div class="procedimento">${esc(item.procedimento)}</div>
                        ${item.observacao ? `<div class="obs">${icone('mensagem')}<span>${esc(item.observacao)}</span></div>` : ''}
                    </div>
                    ${admin ? `<div class="celula-prof a-prof">${esc(item.profissional)}</div>` : ''}
                    <div class="a-uni">${esc(item.unidade)}</div>
                    <div class="a-status">${chipStatus(item.status)}</div>
                </div>`).join('')}
            </div>`;
    }

    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    el.contagem.textContent = total
        ? `${numero(pagina * POR_PAGINA + 1)}–${numero(Math.min((pagina + 1) * POR_PAGINA, total))} de ${numero(total)} · página ${pagina + 1} de ${numero(paginas)}`
        : '';
    el.anterior.disabled = pagina === 0;
    el.proxima.disabled = pagina >= paginas - 1;
}

function abrir(item) {
    abrirDetalhe(item, { admin, aoSalvar: () => carregar({ manterPagina: true }) });
}

// ── Exportação ─────────────────────────────────────────────────────────────

async function exportar() {
    const botao = $('exportar');
    botaoCarregando(botao, true, 'Exportando...');
    const f = filtrosAtuais();
    const todos = [];
    // O banco devolve no máximo 1000 linhas por consulta
    for (let inicio = 0; ; inicio += 1000) {
        const { data, error } = await montarConsulta(f).range(inicio, inicio + 999);
        if (error) {
            botaoCarregando(botao, false);
            toast(mensagemErro(error), { tipo: 'erro' });
            return;
        }
        todos.push(...data);
        if (data.length < 1000) break;
    }

    const celula = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
        ['Registrado em', 'Unidade', 'Paciente', 'Procedimento', 'Profissional', 'Status', 'Observação'],
        ...todos.map(l => [dataHora(l.created_at), l.unidade, l.paciente, l.procedimento, l.profissional, l.status, l.observacao]),
    ].map(linha => linha.map(celula).join(';')).join('\r\n');

    // BOM + ";" para o Excel em português abrir com acentos e colunas certas
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `finalizacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
    botaoCarregando(botao, false);
    toast(`${numero(todos.length)} registros exportados.`);
}

// ── Eventos ────────────────────────────────────────────────────────────────

el.lista.addEventListener('click', (evento) => {
    if (evento.target.closest('[data-tentar-de-novo]')) {
        primeiraCarga = true;
        carregar();
        return;
    }
    const linha = evento.target.closest('.linha[data-id]');
    if (linha && !evento.target.closest('button')) abrir(itens.find(i => i.id === Number(linha.dataset.id)));
});
el.lista.addEventListener('keydown', (evento) => {
    const linha = evento.target.closest?.('.linha[data-id]');
    if (linha && evento.key === 'Enter' && evento.target === linha) abrir(itens.find(i => i.id === Number(linha.dataset.id)));
});
el.resumo.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-status]');
    if (!botao) return;
    status = botao.dataset.status;
    carregar();
});
el.busca.addEventListener('input', debounce(() => carregar(), 300));
[el.unidade, el.profissional, el.de, el.ate].forEach(c => c.addEventListener('change', () => carregar()));
el.anterior.addEventListener('click', () => { pagina--; carregar({ manterPagina: true }); window.scrollTo({ top: 0 }); });
el.proxima.addEventListener('click', () => { pagina++; carregar({ manterPagina: true }); window.scrollTo({ top: 0 }); });
$('exportar').addEventListener('click', exportar);

await carregar();

// Link direto para um registro: registros.html?id=123
if (params.id) {
    const { data } = await sb.from('finalizacoes').select(COLUNAS).eq('id', Number(params.id)).maybeSingle();
    if (data) abrir(data);
}
