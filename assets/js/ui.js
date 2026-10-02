// Componentes e utilitários de interface compartilhados por todas as telas.
import { icone } from './icones.js';
import { STATUS } from './supabase.js';

// ── Texto e formatação ─────────────────────────────────────────────────────

export function esc(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

const FUSO = 'America/Sao_Paulo';
const fmtDataHora = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, dateStyle: 'short', timeStyle: 'short' });
const fmtData = new Intl.DateTimeFormat('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' });
const fmtDiaMes = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
const fmtNumero = new Intl.NumberFormat('pt-BR');

export const dataHora = iso => fmtDataHora.format(new Date(iso));
export const data = iso => fmtData.format(new Date(iso));
// Datas "puras" (yyyy-mm-dd) vindas do banco
export const diaMes = dia => fmtDiaMes.format(new Date(`${dia}T00:00:00Z`));
export const numero = n => fmtNumero.format(Number(n ?? 0));
export const percentual = (v, casas = 0) => v == null ? '—' : `${(Number(v) * 100).toFixed(casas).replace('.', ',')}%`;

export function duracaoHoras(horas) {
    if (horas == null) return '—';
    const h = Number(horas);
    if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
    if (h < 48) return `${Math.round(h)} h`;
    return `${(h / 24).toFixed(h < 240 ? 1 : 0).replace('.', ',')} dias`;
}

// Idade de um registro aberto: texto relativo + nível de atenção
export function idade(iso) {
    const minutos = (Date.now() - new Date(iso)) / 60000;
    const dias = Math.floor(minutos / 1440);
    let texto;
    if (minutos < 60) texto = `há ${Math.max(1, Math.round(minutos))} min`;
    else if (minutos < 1440) texto = `há ${Math.round(minutos / 60)} h`;
    else if (dias === 1) texto = 'há 1 dia';
    else texto = `há ${dias} dias`;
    const classe = dias >= 30 ? 'idade--critica' : dias >= 7 ? 'idade--alerta' : '';
    return { texto, dias, classe };
}

export function iniciais(nome) {
    const partes = String(nome ?? '').replace(/^(dr|dra)\.?\s+/i, '').split(/\s+/).filter(Boolean);
    return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes.at(-1)[0] : '')).toUpperCase() || '?';
}

// ── Período (fuso de Brasília, sem horário de verão) ───────────────────────

function hojeBrasilia() {
    return new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);
}

// Últimos N dias incluindo hoje: [início do dia N-1 atrás, início de amanhã)
export function ultimosDias(n) {
    const amanha = new Date(`${hojeBrasilia()}T00:00:00-03:00`).getTime() + 86400000;
    return { de: new Date(amanha - n * 86400000).toISOString(), ate: new Date(amanha).toISOString() };
}

export function intervaloDeDatas(deDia, ateDia) {
    return {
        de: deDia ? new Date(`${deDia}T00:00:00-03:00`).toISOString() : null,
        ate: ateDia ? new Date(new Date(`${ateDia}T00:00:00-03:00`).getTime() + 86400000).toISOString() : null,
    };
}

// ── Status ─────────────────────────────────────────────────────────────────

const VISUAL_STATUS = {
    [STATUS.PENDENTE]: { classe: 'st-pendente', icone: 'circuloTracejado' },
    [STATUS.LIBERACAO]: { classe: 'st-liberacao', icone: 'ampulheta' },
    [STATUS.PAGAMENTO]: { classe: 'st-pagamento', icone: 'carteira' },
    [STATUS.FINALIZADO]: { classe: 'st-finalizado', icone: 'circuloCheck' },
    [STATUS.RECUSADO]: { classe: 'st-recusado', icone: 'circuloX' },
};

export const classeStatus = status => VISUAL_STATUS[status]?.classe ?? '';

export function chipStatus(status) {
    const v = VISUAL_STATUS[status] ?? { classe: '', icone: 'info' };
    return `<span class="status ${v.classe}">${icone(v.icone)}${esc(status)}</span>`;
}

// ── Nome copiável ──────────────────────────────────────────────────────────

export function nomeCopiavel(nome) {
    return `<button type="button" class="copiavel" data-copiar="${esc(nome)}" title="Copiar nome">`
        + `<span>${esc(nome)}</span>${icone('copiar', 'icone--sm')}</button>`;
}

export async function copiarTexto(texto, origem) {
    try {
        await navigator.clipboard.writeText(texto);
    } catch {
        // Sem permissão de área de transferência: seleciona para cópia manual
        const alvo = origem?.querySelector('span') ?? origem;
        if (alvo) {
            const faixa = document.createRange();
            faixa.selectNodeContents(alvo);
            getSelection().removeAllRanges();
            getSelection().addRange(faixa);
        }
        toast('Não foi possível copiar automaticamente — o nome está selecionado, use Ctrl+C.', { tipo: 'erro' });
        return false;
    }
    if (origem) {
        origem.classList.add('copiado');
        const iconeAtual = origem.querySelector('.icone');
        iconeAtual?.insertAdjacentHTML('afterend', icone('check', 'icone--sm'));
        iconeAtual?.remove();
        clearTimeout(origem._timer);
        origem._timer = setTimeout(() => {
            origem.classList.remove('copiado');
            origem.querySelector('.icone')?.insertAdjacentHTML('afterend', icone('copiar', 'icone--sm'));
            origem.querySelector('.icone')?.remove();
        }, 1600);
    }
    toast(`Copiado: ${texto}`);
    return true;
}

// Um único ouvinte para todos os nomes copiáveis da página
document.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-copiar]');
    if (!botao) return;
    evento.stopPropagation();
    copiarTexto(botao.dataset.copiar, botao);
});

// ── Toast ──────────────────────────────────────────────────────────────────

export function toast(mensagem, { tipo = '', acao = null, duracao = 3200 } = {}) {
    let area = document.querySelector('.toasts');
    if (!area) {
        area = document.createElement('div');
        area.className = 'toasts';
        area.setAttribute('role', 'status');
        area.setAttribute('aria-live', 'polite');
        document.body.append(area);
    }
    // No máximo 3 empilhados (um "Desfazer" não some ao copiar o próximo nome)
    while (area.children.length >= 3) area.firstElementChild.remove();

    const el = document.createElement('div');
    el.className = `toast ${tipo ? 'toast--' + tipo : ''}`;
    const texto = document.createElement('span');
    texto.textContent = mensagem;
    el.append(texto);

    let fechado = false;
    const fechar = () => {
        if (fechado) return;
        fechado = true;
        el.remove();
    };

    if (acao) {
        const botao = document.createElement('button');
        botao.type = 'button';
        botao.textContent = acao.rotulo;
        botao.addEventListener('click', () => { fechar(); acao.aoClicar(); });
        el.append(botao);
    }

    area.append(el);
    setTimeout(fechar, duracao);
    return fechar;
}

// ── Modal ──────────────────────────────────────────────────────────────────

export function abrirModal({ titulo, descricao = '', corpo = '', rodape = '', largo = false, aoFechar = null }) {
    const gatilho = document.activeElement;
    const fundo = document.createElement('div');
    fundo.className = 'modal-fundo';
    fundo.innerHTML = `
        <div class="modal ${largo ? 'modal--largo' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-titulo">
            <div class="modal__cab">
                <div>
                    <h2 id="modal-titulo">${esc(titulo)}</h2>
                    ${descricao ? `<p>${descricao}</p>` : ''}
                </div>
                <button type="button" class="btn btn--fantasma btn--icone btn--sm" data-fechar aria-label="Fechar">${icone('fechar')}</button>
            </div>
            <div class="modal__corpo">${corpo}</div>
            ${rodape ? `<div class="modal__rodape">${rodape}</div>` : ''}
        </div>`;

    const modal = fundo.querySelector('.modal');
    const fechar = () => {
        fundo.remove();
        document.removeEventListener('keydown', teclado, true);
        gatilho?.focus?.();
        aoFechar?.();
    };

    function teclado(evento) {
        if (evento.key === 'Escape') {
            evento.stopPropagation();
            fechar();
            return;
        }
        if (evento.key !== 'Tab') return;
        const focaveis = [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]
            .filter(el => !el.disabled && el.offsetParent !== null);
        if (!focaveis.length) return;
        const [primeiro, ultimo] = [focaveis[0], focaveis.at(-1)];
        if (evento.shiftKey && document.activeElement === primeiro) { evento.preventDefault(); ultimo.focus(); }
        else if (!evento.shiftKey && document.activeElement === ultimo) { evento.preventDefault(); primeiro.focus(); }
    }

    fundo.addEventListener('mousedown', (evento) => { if (evento.target === fundo) fechar(); });
    fundo.querySelectorAll('[data-fechar]').forEach(b => b.addEventListener('click', fechar));
    document.addEventListener('keydown', teclado, true);
    document.body.append(fundo);

    const autofoco = modal.querySelector('[autofocus]') ?? modal.querySelector('.modal__corpo input, .modal__corpo select, .modal__corpo textarea, .modal__corpo button') ?? modal;
    autofoco.focus();

    return { el: modal, fechar };
}

// ── Estados ────────────────────────────────────────────────────────────────

export function esqueletoLinhas(quantidade = 6) {
    return Array.from({ length: quantidade }, (_, i) => `
        <div class="linha" aria-hidden="true">
            <div style="grid-column: 1 / -1">
                <div class="esqueleto esqueleto-linha" style="width:${40 + (i * 13) % 35}%"></div>
                <div class="esqueleto esqueleto-linha" style="width:${25 + (i * 7) % 30}%; height:10px"></div>
            </div>
        </div>`).join('');
}

export function vazio({ icone: nomeIcone = 'info', titulo, texto = '', sucesso = false }) {
    return `<div class="vazio ${sucesso ? 'vazio--sucesso' : ''}">${icone(nomeIcone)}<h2>${esc(titulo)}</h2>${texto ? `<p>${esc(texto)}</p>` : ''}</div>`;
}

export function falha(mensagem = 'Não foi possível carregar os dados.') {
    return `<div class="falha" role="alert">${icone('alerta')}<h2>Algo deu errado</h2><p>${esc(mensagem)}</p>`
        + `<button type="button" class="btn" data-tentar-de-novo>${icone('atualizar')}Tentar de novo</button></div>`;
}

export function botaoCarregando(botao, carregando, rotulo) {
    if (carregando) {
        botao._rotulo = botao.innerHTML;
        botao.disabled = true;
        botao.innerHTML = `${icone('carregando', 'carregando-icone')}${esc(rotulo ?? 'Salvando...')}`;
    } else {
        botao.disabled = false;
        if (botao._rotulo) botao.innerHTML = botao._rotulo;
    }
}

// ── Utilitários ────────────────────────────────────────────────────────────

export function debounce(fn, espera = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), espera);
    };
}

export function lerParametros() {
    return Object.fromEntries(new URLSearchParams(location.search));
}

export function gravarParametros(valores) {
    const params = new URLSearchParams();
    Object.entries(valores).forEach(([chave, valor]) => {
        if (valor !== null && valor !== undefined && valor !== '') params.set(chave, valor);
    });
    const consulta = params.toString();
    history.replaceState(null, '', consulta ? `?${consulta}` : location.pathname);
}

export function preencherSelect(select, opcoes, { vazio: rotuloVazio = null, valor = '' } = {}) {
    select.innerHTML = (rotuloVazio !== null ? `<option value="">${esc(rotuloVazio)}</option>` : '')
        + opcoes.map(o => {
            const [v, r] = Array.isArray(o) ? o : [o, o];
            return `<option value="${esc(v)}">${esc(r)}</option>`;
        }).join('');
    select.value = valor;
}

// Mensagens de erro do banco em linguagem humana
export function mensagemErro(erro) {
    if (!erro) return 'Erro desconhecido.';
    if (erro.code === '23514' && /motivo/.test(erro.message)) return 'Informe o motivo da recusa.';
    if (erro.code === '42501') return 'Você não tem permissão para esta ação.';
    if (/Failed to fetch|NetworkError/i.test(erro.message)) return 'Sem conexão. Verifique a internet e tente de novo.';
    return erro.message;
}

// Troca <i data-icone="nome"></i> do HTML estático pelo SVG correspondente
export function aplicarIcones(raiz = document) {
    raiz.querySelectorAll('[data-icone]').forEach(el => {
        el.outerHTML = icone(el.dataset.icone, el.className);
    });
}

// Botão "Filtros" do celular: mostra/esconde os filtros secundários
export function ativarFiltrosMoveis(botao, filtros) {
    if (!botao || !filtros) return;
    botao.addEventListener('click', () => {
        const expandir = !filtros.classList.contains('expandido');
        filtros.classList.toggle('expandido', expandir);
        botao.setAttribute('aria-expanded', String(expandir));
    });
}

// ── Tema claro/escuro ──────────────────────────────────────────────────────
// A escolha fica no aparelho; sem escolha, segue o sistema operacional.
// Cada página aplica o tema salvo num <script> no <head>, antes de desenhar, para não piscar.

const CHAVE_TEMA = 'finaliza:tema';
const sistemaEscuro = matchMedia('(prefers-color-scheme: dark)');

export function temaAtual() {
    return document.documentElement.dataset.theme || (sistemaEscuro.matches ? 'dark' : 'light');
}

export function botaoTema(classe = '') {
    return `<button type="button" class="btn btn--fantasma btn--icone btn--sm ${classe}" data-alternar-tema></button>`;
}

function atualizarBotoesTema() {
    const escuro = temaAtual() === 'dark';
    document.querySelectorAll('[data-alternar-tema]').forEach(botao => {
        botao.innerHTML = icone(escuro ? 'sol' : 'lua');
        const rotulo = escuro ? 'Usar tema claro' : 'Usar tema escuro';
        botao.setAttribute('aria-label', rotulo);
        botao.title = rotulo;
    });
}

export function ativarTema() {
    atualizarBotoesTema();
    sistemaEscuro.addEventListener('change', atualizarBotoesTema);
}

document.addEventListener('click', (evento) => {
    if (!evento.target.closest('[data-alternar-tema]')) return;
    const novo = temaAtual() === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = novo;
    try { localStorage.setItem(CHAVE_TEMA, novo); } catch { /* navegação privada */ }
    atualizarBotoesTema();
});

// ── Seletor em botões (segmentado) ─────────────────────────────────────────
// Para poucas opções (ex.: unidades). O elemento ganha `.value` e dispara `change`,
// então as telas o usam como se fosse um <select>.

export function segmentado(el, opcoes, { valor = '' } = {}) {
    el.classList.add('segmentado');
    el.setAttribute('role', 'group');
    el.innerHTML = opcoes.map(o => {
        const [v, r] = Array.isArray(o) ? o : [o, o];
        return `<button type="button" data-valor="${esc(v)}">${esc(r)}</button>`;
    }).join('');

    let atual = valor;
    const marcar = () => el.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.valor === atual)));
    Object.defineProperty(el, 'value', {
        get: () => atual,
        set: (novo) => { atual = novo ?? ''; marcar(); },
        configurable: true,
    });
    el.addEventListener('click', (evento) => {
        const botao = evento.target.closest('button[data-valor]');
        if (!botao || botao.dataset.valor === atual) return;
        atual = botao.dataset.valor;
        marcar();
        el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    el.focus = () => (el.querySelector('[aria-pressed="true"]') ?? el.querySelector('button'))?.focus();
    marcar();
    return el;
}
