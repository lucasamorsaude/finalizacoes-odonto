// Fila de finalização — admin opera (copiar, finalizar, lote, status); profissional acompanha os seus.
import { iniciarApp, atualizarContadorFila } from '../app.js';
import { sb, STATUS, STATUS_ABERTOS, STATUS_TODOS, UNIDADES } from '../supabase.js';
import { icone } from '../icones.js';
import {
    esc, idade, dataHora, chipStatus, classeStatus, nomeCopiavel, copiarTexto, toast, esqueletoLinhas, vazio, falha,
    debounce, lerParametros, gravarParametros, preencherSelect, numero, mensagemErro, aplicarIcones, abrirModal,
    botaoCarregando, ativarFiltrosMoveis,
} from '../ui.js';
import { abrirDetalhe } from '../detalhe.js';

aplicarIcones();
ativarFiltrosMoveis(document.getElementById('mostrar-filtros'), document.getElementById('filtros'));
const perfil = await iniciarApp({ tela: 'fila' });
const admin = perfil.is_admin;

const POR_PAGINA = 100;
const COLUNAS = 'id, unidade, paciente, procedimento, profissional, status, observacao, created_at, updated_at';

const $ = id => document.getElementById(id);
const el = {
    descricao: $('descricao'), busca: $('f-busca'), unidade: $('f-unidade'), profissional: $('f-profissional'),
    idade: $('f-idade'), ordem: $('f-ordem'), resumo: $('resumo'), lista: $('lista'), contagem: $('contagem'),
    mais: $('mais'), barraLote: $('barra-lote'), loteQtd: $('lote-qtd'),
};

const estado = {
    itens: [],
    total: 0,
    resumo: {},
    status: '',
    selecionados: new Set(),
    carregadoEm: 0,
    primeiraCarga: true,
};

// ── Configuração inicial ───────────────────────────────────────────────────

const params = lerParametros();
preencherSelect(el.unidade, UNIDADES, { vazio: 'Todas', valor: params.unidade ?? '' });
el.busca.value = params.busca ?? '';
el.idade.value = params.idade ?? '';
el.ordem.value = params.ordem ?? 'antigos';
estado.status = STATUS_ABERTOS.includes(params.status) ? params.status : '';

if (admin) {
    $('campo-profissional').hidden = false;
    $('atalhos').hidden = false;
    el.lista.style.setProperty('--colunas', '28px minmax(0, 1fr) 180px 96px 104px 196px 152px');
    el.lista.style.setProperty('--areas-movel', '"sel pac pac" ". prof prof" ". uni idade" ". status acoes"');
    const { data } = await sb.rpc('profissionais_registrados');
    preencherSelect(el.profissional, data ?? [], { vazio: 'Todos', valor: params.profissional ?? '' });
} else {
    el.descricao.textContent = 'Seus registros que ainda não foram finalizados pela administração.';
    el.lista.style.setProperty('--colunas', 'minmax(0, 1fr) 96px 104px 196px');
    el.lista.style.setProperty('--areas-movel', '"pac pac pac" "uni uni idade" "status status status"');
    $('lista-recusados').style.setProperty('--colunas', 'minmax(0, 1fr) 96px 140px 140px');
    $('lista-recusados').style.setProperty('--areas-movel', '"pac pac pac" "uni uni idade" "status status status"');
}

// ── Consulta ───────────────────────────────────────────────────────────────

function filtrosAtuais() {
    const [min, max] = (el.idade.value || '-').split('-').map(v => (v === '' ? null : Number(v)));
    return {
        unidade: el.unidade.value || null,
        profissional: admin ? (el.profissional.value || null) : null,
        busca: el.busca.value.trim() || null,
        idadeMin: min,
        idadeMax: max,
    };
}

function diasAtras(dias) {
    return new Date(Date.now() - dias * 86400000).toISOString();
}

async function carregar({ acrescentar = false, silencioso = false } = {}) {
    const f = filtrosAtuais();
    gravarParametros({
        busca: f.busca, unidade: f.unidade, profissional: f.profissional, idade: el.idade.value,
        status: estado.status, ordem: el.ordem.value === 'antigos' ? null : el.ordem.value,
    });

    const inicio = acrescentar ? estado.itens.length : 0;
    const fim = acrescentar
        ? inicio + POR_PAGINA - 1
        : (silencioso ? Math.max(estado.itens.length, POR_PAGINA) : POR_PAGINA) - 1;

    if (estado.primeiraCarga) el.lista.innerHTML = esqueletoLinhas(8);
    else if (!acrescentar) el.lista.classList.add('recarregando');
    el.mais.disabled = true;

    let consulta = sb.from('finalizacoes').select(COLUNAS, { count: 'exact' })
        .in('status', estado.status ? [estado.status] : STATUS_ABERTOS);
    if (f.unidade) consulta = consulta.eq('unidade', f.unidade);
    if (f.profissional) consulta = consulta.eq('profissional', f.profissional);
    if (f.busca) consulta = consulta.ilike('paciente', `%${f.busca}%`);
    if (f.idadeMin !== null) consulta = consulta.lte('created_at', diasAtras(f.idadeMin));
    if (f.idadeMax !== null) consulta = consulta.gt('created_at', diasAtras(f.idadeMax));
    const asc = el.ordem.value === 'antigos';
    consulta = consulta.order('created_at', { ascending: asc }).order('id', { ascending: asc }).range(inicio, fim);

    const [lista, resumo] = await Promise.all([
        consulta,
        acrescentar ? null : sb.rpc('resumo_fila', {
            p_unidade: f.unidade, p_profissional: f.profissional, p_paciente: f.busca,
            p_idade_min: f.idadeMin, p_idade_max: f.idadeMax,
        }),
    ]);

    el.lista.classList.remove('recarregando');
    el.mais.disabled = false;

    if (lista.error) {
        console.error(lista.error);
        if (estado.primeiraCarga) el.lista.innerHTML = falha(mensagemErro(lista.error));
        else toast(mensagemErro(lista.error), { tipo: 'erro' });
        return;
    }

    estado.primeiraCarga = false;
    estado.carregadoEm = Date.now();
    estado.itens = acrescentar ? estado.itens.concat(lista.data) : lista.data;
    estado.total = lista.count ?? estado.itens.length;
    if (resumo?.data) estado.resumo = Object.fromEntries(resumo.data.map(r => [r.status, Number(r.total)]));

    // Mantém só a seleção de itens que continuam na lista
    const ids = new Set(estado.itens.map(i => i.id));
    estado.selecionados.forEach(id => { if (!ids.has(id)) estado.selecionados.delete(id); });

    renderizar();
}

// ── Renderização ───────────────────────────────────────────────────────────

function renderizarResumo() {
    const total = STATUS_ABERTOS.reduce((soma, s) => soma + (estado.resumo[s] ?? 0), 0);
    const botoes = [['', 'Todos', total], ...STATUS_ABERTOS.map(s => [s, s, estado.resumo[s] ?? 0])];
    el.resumo.innerHTML = botoes.map(([valor, rotulo, qtd]) => `
        <button type="button" class="${classeStatus(valor)}" data-status="${esc(valor)}" aria-pressed="${estado.status === valor}">
            ${esc(rotulo)} <strong class="num">${numero(qtd)}</strong>
        </button>`).join('');
}

function cabecalhoLista() {
    if (!admin) {
        return `<div class="lista__cab" aria-hidden="true">
            <div>Paciente / procedimento</div><div>Unidade</div><div>Na fila</div><div>Status</div></div>`;
    }
    const todos = estado.itens.length > 0 && estado.itens.every(i => estado.selecionados.has(i.id));
    return `<div class="lista__cab">
        <div><input type="checkbox" class="caixa" data-sel-todos aria-label="Selecionar todos os itens carregados" ${todos ? 'checked' : ''}></div>
        <div>Paciente / procedimento</div><div>Profissional</div><div>Unidade</div><div>Na fila</div><div>Status</div><div></div>
    </div>`;
}

function linhaHtml(item) {
    const i = idade(item.created_at);
    const selecionado = estado.selecionados.has(item.id);
    const obs = item.observacao
        ? `<div class="obs">${icone('mensagem')}<span>${esc(item.observacao)}</span></div>` : '';

    const paciente = `
        <div class="celula-paciente a-pac">
            ${nomeCopiavel(item.paciente)}
            <div class="procedimento">${esc(item.procedimento)}</div>
            ${obs}
        </div>`;
    const comum = `
        <div class="a-uni"><span class="rotulo-movel">Unidade: </span>${esc(item.unidade)}</div>
        <div class="a-idade"><span class="idade ${i.classe}" title="Registrado em ${dataHora(item.created_at)}">${i.texto}</span></div>
        <div class="a-status">${chipStatus(item.status)}</div>`;

    if (!admin) {
        return `<div class="linha clicavel" role="listitem" tabindex="0" data-id="${item.id}">${paciente}${comum}</div>`;
    }

    return `
        <div class="linha ${selecionado ? 'selecionada' : ''}" role="listitem" tabindex="0" data-id="${item.id}">
            <div class="a-sel"><input type="checkbox" class="caixa" data-sel ${selecionado ? 'checked' : ''} aria-label="Selecionar ${esc(item.paciente)}"></div>
            ${paciente}
            <div class="celula-prof a-prof">${esc(item.profissional)}</div>
            ${comum}
            <div class="celula-acoes a-acoes">
                <button type="button" class="btn btn--sm btn--primario" data-acao="finalizar">${icone('check', 'icone--sm')}Finalizar</button>
                <button type="button" class="btn btn--sm btn--icone" data-acao="detalhe" aria-label="Mais opções para ${esc(item.paciente)}" title="Status, observação e histórico">${icone('reticencias')}</button>
            </div>
        </div>`;
}

function renderizar() {
    renderizarResumo();

    if (!estado.itens.length) {
        const semFiltro = !Object.values(filtrosAtuais()).some(v => v !== null) && !estado.status;
        el.lista.innerHTML = semFiltro
            ? vazio({
                icone: 'circuloCheck', sucesso: true,
                titulo: admin ? 'Fila zerada!' : 'Nada pendente',
                texto: admin ? 'Nenhum item aguardando finalização.' : 'Todos os seus registros já foram finalizados.',
            })
            : vazio({ icone: 'busca', titulo: 'Nenhum item encontrado', texto: 'Ajuste os filtros para ver outros itens.' });
    } else {
        el.lista.innerHTML = cabecalhoLista()
            + `<div role="list" aria-label="Itens da fila">${estado.itens.map(linhaHtml).join('')}</div>`;
    }

    el.contagem.textContent = estado.total
        ? `Mostrando ${numero(estado.itens.length)} de ${numero(estado.total)}`
        : '';
    el.mais.hidden = estado.itens.length >= estado.total;
    renderizarLote();
}

function renderizarLote() {
    const qtd = estado.selecionados.size;
    el.barraLote.hidden = qtd === 0;
    el.loteQtd.textContent = qtd === 1 ? '1 selecionado' : `${qtd} selecionados`;
}

const itemPorId = id => estado.itens.find(i => i.id === Number(id));
const linhaPorId = id => el.lista.querySelector(`.linha[data-id="${id}"]`);

// ── Ações ──────────────────────────────────────────────────────────────────

async function finalizar(ids) {
    const itens = ids.map(itemPorId).filter(Boolean);
    if (!itens.length) return;

    // Retorno visual imediato; a lista só muda de fato após o banco confirmar
    itens.forEach(i => linhaPorId(i.id)?.classList.add('saindo'));

    const { data, error } = await sb.from('finalizacoes')
        .update({ status: STATUS.FINALIZADO })
        .in('id', itens.map(i => i.id))
        .select('id');

    if (error || !data?.length) {
        itens.forEach(i => linhaPorId(i.id)?.classList.remove('saindo'));
        toast(error ? mensagemErro(error) : 'Nenhum item foi alterado.', { tipo: 'erro' });
        return;
    }

    removerDaLista(itens);
    toast(itens.length === 1 ? `Finalizado: ${itens[0].paciente}` : `${itens.length} itens finalizados`, {
        acao: { rotulo: 'Desfazer', aoClicar: () => desfazer(itens) },
        duracao: 7000,
    });
}

function removerDaLista(itens) {
    const ids = new Set(itens.map(i => i.id));
    const focoNaLista = document.activeElement?.closest?.('.linha');
    const proximaFocada = focoNaLista && ids.has(Number(focoNaLista.dataset.id))
        ? [...el.lista.querySelectorAll('.linha[data-id]')].find(l => !ids.has(Number(l.dataset.id))
            && l.compareDocumentPosition(focoNaLista) & Node.DOCUMENT_POSITION_PRECEDING)
        : null;

    estado.itens = estado.itens.filter(i => !ids.has(i.id));
    estado.total = Math.max(0, estado.total - itens.length);
    itens.forEach(i => {
        estado.resumo[i.status] = Math.max(0, (estado.resumo[i.status] ?? 1) - 1);
        estado.selecionados.delete(i.id);
    });
    renderizar();
    if (proximaFocada) linhaPorId(proximaFocada.dataset.id)?.focus();
    atualizarContadorFila();
}

async function desfazer(itens) {
    const porStatus = new Map();
    itens.forEach(i => porStatus.set(i.status, [...(porStatus.get(i.status) ?? []), i]));
    const resultados = await Promise.all([...porStatus].map(([status, grupo]) =>
        sb.from('finalizacoes').update({ status }).in('id', grupo.map(i => i.id))));
    const erro = resultados.find(r => r.error)?.error;
    if (erro) toast(mensagemErro(erro), { tipo: 'erro' });
    else toast(itens.length === 1 ? 'Finalização desfeita.' : `${itens.length} finalizações desfeitas.`);
    await carregar({ silencioso: true });
    atualizarContadorFila();
}

function abrir(item, statusInicial = null) {
    abrirDetalhe(item, {
        admin,
        statusInicial,
        aoSalvar: () => {
            carregar({ silencioso: true });
            atualizarContadorFila();
        },
    });
}

function alterarStatusEmLote() {
    const ids = [...estado.selecionados];
    const { el: modal, fechar } = abrirModal({
        titulo: `Alterar status de ${ids.length} ${ids.length === 1 ? 'item' : 'itens'}`,
        corpo: `
            <form id="form-lote" novalidate style="display:flex;flex-direction:column;gap:14px">
                <div class="opcoes-status">
                    ${STATUS_TODOS.map((s, n) => `<label><input type="radio" name="status" value="${esc(s)}" ${n === 0 ? 'checked' : ''}>${esc(s)}</label>`).join('')}
                </div>
                <div class="campo">
                    <label for="lote-obs" id="lote-obs-rotulo">Observação (opcional)</label>
                    <textarea id="lote-obs" class="entrada" maxlength="1000" placeholder="Se preenchida, substitui a observação de todos os selecionados"></textarea>
                    <span class="erro-campo" id="lote-obs-erro" hidden>Informe o motivo da recusa.</span>
                </div>
            </form>`,
        rodape: `<button type="button" class="btn" data-fechar>Cancelar</button>
                 <button type="submit" form="form-lote" class="btn btn--primario">Aplicar</button>`,
    });

    const form = modal.querySelector('#form-lote');
    const obs = modal.querySelector('#lote-obs');
    form.addEventListener('change', () => {
        const recusa = form.status.value === STATUS.RECUSADO;
        modal.querySelector('#lote-obs-rotulo').textContent = recusa ? 'Motivo da recusa (obrigatório)' : 'Observação (opcional)';
    });
    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const status = form.status.value;
        const texto = obs.value.trim();
        if (status === STATUS.RECUSADO && !texto) {
            modal.querySelector('#lote-obs-erro').hidden = false;
            obs.focus();
            return;
        }
        const botao = modal.querySelector('button[type="submit"]');
        botaoCarregando(botao, true);
        const { data, error } = await sb.from('finalizacoes')
            .update(texto ? { status, observacao: texto } : { status })
            .in('id', ids)
            .select('id');
        botaoCarregando(botao, false);
        if (error) {
            toast(mensagemErro(error), { tipo: 'erro' });
            return;
        }
        fechar();
        estado.selecionados.clear();
        toast(`${data.length} ${data.length === 1 ? 'item alterado' : 'itens alterados'} para ${status}.`);
        carregar({ silencioso: true });
        atualizarContadorFila();
    });
}

// ── Eventos ────────────────────────────────────────────────────────────────

el.lista.addEventListener('click', (evento) => {
    if (evento.target.closest('[data-tentar-de-novo]')) {
        estado.primeiraCarga = true;
        carregar();
        return;
    }
    const linha = evento.target.closest('.linha[data-id]');
    if (!linha) return;
    const item = itemPorId(linha.dataset.id);
    const acao = evento.target.closest('[data-acao]')?.dataset.acao;

    if (acao === 'finalizar') finalizar([item.id]);
    else if (acao === 'detalhe') abrir(item);
    else if (!evento.target.closest('button, input, a')) {
        if (admin) alternarSelecao(item.id);
        else abrir(item);
    }
});

el.lista.addEventListener('change', (evento) => {
    if (evento.target.matches('[data-sel-todos]')) {
        if (evento.target.checked) estado.itens.forEach(i => estado.selecionados.add(i.id));
        else estado.selecionados.clear();
        renderizar();
    } else if (evento.target.matches('[data-sel]')) {
        alternarSelecao(Number(evento.target.closest('.linha').dataset.id), evento.target.checked);
    }
});

function alternarSelecao(id, marcar = !estado.selecionados.has(id)) {
    if (marcar) estado.selecionados.add(id);
    else estado.selecionados.delete(id);
    const linha = linhaPorId(id);
    linha?.classList.toggle('selecionada', marcar);
    const caixa = linha?.querySelector('[data-sel]');
    if (caixa) caixa.checked = marcar;
    const todos = el.lista.querySelector('[data-sel-todos]');
    if (todos) todos.checked = estado.itens.every(i => estado.selecionados.has(i.id));
    renderizarLote();
}

el.resumo.addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-status]');
    if (!botao) return;
    estado.status = botao.dataset.status;
    carregar();
});

const recarregarFiltros = () => carregar();
el.busca.addEventListener('input', debounce(recarregarFiltros, 300));
[el.unidade, el.profissional, el.idade, el.ordem].forEach(s => s.addEventListener('change', recarregarFiltros));
el.mais.addEventListener('click', () => carregar({ acrescentar: true }));
$('atualizar').addEventListener('click', () => carregar());
$('lote-finalizar').addEventListener('click', () => finalizar([...estado.selecionados]));
$('lote-status').addEventListener('click', alterarStatusEmLote);
$('lote-limpar').addEventListener('click', () => {
    estado.selecionados.clear();
    renderizar();
});

// Atalhos de teclado (a linha focada é o alvo)
document.addEventListener('keydown', (evento) => {
    if (evento.ctrlKey || evento.metaKey || evento.altKey || document.querySelector('.modal-fundo')) return;
    const alvo = evento.target;
    if (alvo.matches('input:not([type="checkbox"]), textarea, select')) {
        if (evento.key === 'Escape' && alvo === el.busca) el.busca.blur();
        if (evento.key === 'ArrowDown' && alvo === el.busca) {
            evento.preventDefault();
            el.lista.querySelector('.linha[data-id]')?.focus();
        }
        return;
    }
    if (evento.key === '/') {
        evento.preventDefault();
        el.busca.focus();
        return;
    }

    const linha = alvo.closest?.('.linha[data-id]');
    const tecla = evento.key.toLowerCase();
    if (!linha) {
        if (tecla === 'arrowdown' || tecla === 'j') {
            const primeira = el.lista.querySelector('.linha[data-id]');
            if (primeira) {
                evento.preventDefault();
                primeira.focus();
            }
        }
        return;
    }

    const item = itemPorId(linha.dataset.id);
    const linhas = [...el.lista.querySelectorAll('.linha[data-id]')];
    const pos = linhas.indexOf(linha);

    if (tecla === 'arrowdown' || tecla === 'j') linhas[pos + 1]?.focus();
    else if (tecla === 'arrowup' || tecla === 'k') linhas[pos - 1]?.focus();
    else if (tecla === 'c') copiarTexto(item.paciente, linha.querySelector('.copiavel'));
    else if (tecla === 'enter' && alvo === linha) abrir(item);
    else if (admin && tecla === 'f') finalizar([item.id]);
    else if (admin && tecla === ' ' && alvo === linha) alternarSelecao(item.id);
    else return;
    evento.preventDefault();
});

// Atualização automática: a cada 60 s e ao voltar para a aba (sem atrapalhar seleção ou modal aberto)
const podeAtualizarSozinho = () => document.visibilityState === 'visible'
    && !document.querySelector('.modal-fundo') && estado.selecionados.size === 0;
setInterval(() => { if (podeAtualizarSozinho()) carregar({ silencioso: true }); }, 60000);
document.addEventListener('visibilitychange', () => {
    if (podeAtualizarSozinho() && Date.now() - estado.carregadoEm > 30000) {
        carregar({ silencioso: true });
        atualizarContadorFila();
    }
});
document.addEventListener('finalizacao-registrada', () => carregar({ silencioso: true }));

// ── Recusados recentes (profissional) ──────────────────────────────────────

async function carregarRecusados() {
    const { data, error } = await sb.from('finalizacoes')
        .select(COLUNAS)
        .eq('status', STATUS.RECUSADO)
        .gte('updated_at', diasAtras(30))
        .order('updated_at', { ascending: false })
        .limit(50);
    if (error || !data.length) return;

    const secao = $('secao-recusados');
    const lista = $('lista-recusados');
    secao.hidden = false;
    lista.innerHTML = `<div role="list">${data.map(item => `
        <div class="linha clicavel" role="listitem" tabindex="0" data-id="${item.id}">
            <div class="celula-paciente a-pac">
                ${nomeCopiavel(item.paciente)}
                <div class="procedimento">${esc(item.procedimento)}</div>
                <div class="obs">${icone('mensagem')}<span><strong>Motivo:</strong> ${esc(item.observacao)}</span></div>
            </div>
            <div class="a-uni">${esc(item.unidade)}</div>
            <div class="a-idade"><span class="idade" title="${dataHora(item.updated_at)}">recusado ${idade(item.updated_at).texto}</span></div>
            <div class="a-status">${chipStatus(item.status)}</div>
        </div>`).join('')}</div>`;
    lista.addEventListener('click', (evento) => {
        const linha = evento.target.closest('.linha[data-id]');
        if (linha && !evento.target.closest('button')) abrirDetalhe(data.find(i => i.id === Number(linha.dataset.id)));
    });
}

await carregar();
if (!admin) carregarRecusados();
