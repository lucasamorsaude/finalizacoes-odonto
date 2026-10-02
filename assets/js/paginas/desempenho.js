// Desempenho por profissional (somente admin): comparação, indicadores ordenáveis e evolução semanal.
import { iniciarApp } from '../app.js';
import { sb, UNIDADES } from '../supabase.js';
import { icone } from '../icones.js';
import { barrasEmpilhadas, colunasEmpilhadas } from '../graficos.js';
import {
    esc, numero, percentual, duracaoHoras, idade, diaMes, ultimosDias, lerParametros, gravarParametros,
    preencherSelect, aplicarIcones, abrirModal, toast, mensagemErro, vazio,
} from '../ui.js';

aplicarIcones();
await iniciarApp({ tela: 'desempenho', somenteAdmin: true });

const $ = id => document.getElementById(id);
const PERIODOS = [7, 30, 90, 365];
const SERIES = [
    { chave: 'finalizados', nome: 'Finalizados', cor: 'var(--serie-1)' },
    { chave: 'em_aberto', nome: 'Em aberto', cor: 'var(--serie-2)' },
    { chave: 'recusados', nome: 'Recusados', cor: 'var(--serie-3)' },
];
const COLUNAS = [
    { chave: 'profissional', rotulo: 'Profissional', texto: true },
    { chave: 'recebidos', rotulo: 'Recebidos' },
    { chave: 'finalizados', rotulo: 'Finalizados' },
    { chave: 'em_aberto', rotulo: 'Em aberto' },
    { chave: 'recusados', rotulo: 'Recusados' },
    { chave: 'taxa_finalizacao', rotulo: 'Taxa de finalização' },
    { chave: 'tempo_medio_horas', rotulo: 'Tempo médio' },
    { chave: 'aberto_mais_antigo', rotulo: 'Aberto mais antigo' },
];

const params = lerParametros();
let dias = PERIODOS.includes(Number(params.periodo)) ? Number(params.periodo) : 30;
let linhas = [];
let ordem = { chave: 'recebidos', desc: true };

preencherSelect($('f-unidade'), UNIDADES, { vazio: 'Todas', valor: params.unidade ?? '' });

async function carregar() {
    $('periodo').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.dias) === dias)));
    const unidade = $('f-unidade').value || null;
    gravarParametros({ periodo: dias === 30 ? null : dias, unidade });

    const { de, ate } = ultimosDias(dias);
    $('conteudo-desempenho').classList.add('recarregando');
    const { data, error } = await sb.rpc('desempenho_profissionais', { p_de: de, p_ate: ate, p_unidade: unidade });
    $('conteudo-desempenho').classList.remove('recarregando');

    if (error) {
        toast(mensagemErro(error), { tipo: 'erro' });
        return;
    }
    linhas = data.map(l => ({
        ...l,
        recebidos: Number(l.recebidos), finalizados: Number(l.finalizados),
        em_aberto: Number(l.em_aberto), recusados: Number(l.recusados),
        taxa_finalizacao: l.taxa_finalizacao === null ? null : Number(l.taxa_finalizacao),
        tempo_medio_horas: l.tempo_medio_horas === null ? null : Number(l.tempo_medio_horas),
    }));
    renderizarGrafico();
    renderizarTabela();
}

function renderizarGrafico() {
    if (!linhas.length) {
        $('grafico').innerHTML = vazio({ icone: 'desempenho', titulo: 'Sem registros no período' });
        return;
    }
    barrasEmpilhadas($('grafico'), {
        descricao: 'Procedimentos recebidos por profissional, por situação atual',
        series: SERIES,
        larguraRotulo: 240,
        dados: [...linhas].sort((a, b) => b.recebidos - a.recebidos).map(l => ({
            rotulo: l.profissional,
            valores: { finalizados: l.finalizados, em_aberto: l.em_aberto, recusados: l.recusados },
            aoClicar: () => abrirEvolucao(l.profissional),
        })),
    });
}

function valorOrdenacao(linha, chave) {
    const v = linha[chave];
    if (chave === 'aberto_mais_antigo') return v ? -new Date(v).getTime() : -Infinity; // mais antigo = maior
    if (v === null || v === undefined) return -Infinity;
    return v;
}

function renderizarTabela() {
    const ordenadas = [...linhas].sort((a, b) => {
        const [va, vb] = [valorOrdenacao(a, ordem.chave), valorOrdenacao(b, ordem.chave)];
        const comp = typeof va === 'string' ? va.localeCompare(vb, 'pt-BR') : va - vb;
        return ordem.desc ? -comp : comp;
    });

    $('tabela').innerHTML = `
        <thead><tr>${COLUNAS.map(c => `
            <th class="${c.texto ? '' : 'direita'}" ${ordem.chave === c.chave ? `aria-sort="${ordem.desc ? 'descending' : 'ascending'}"` : ''}>
                <button type="button" data-ordenar="${c.chave}">${esc(c.rotulo)}${icone(ordem.chave === c.chave ? (ordem.desc ? 'setaBaixo' : 'setaCima') : 'ordenar', 'icone--sm')}</button>
            </th>`).join('')}</tr></thead>
        <tbody>${ordenadas.map(l => {
            const antigo = l.aberto_mais_antigo ? idade(l.aberto_mais_antigo) : null;
            return `<tr>
                <td><button type="button" class="copiavel" style="cursor:pointer" data-evolucao="${esc(l.profissional)}">
                    <span>${esc(l.profissional)}</span></button>
                    ${l.ativo ? '' : '<span class="texto-3 pequeno" style="display:block">inativo</span>'}</td>
                <td class="direita">${numero(l.recebidos)}</td>
                <td class="direita">${numero(l.finalizados)}</td>
                <td class="direita">${l.em_aberto ? `<a href="fila.html?profissional=${encodeURIComponent(l.profissional)}">${numero(l.em_aberto)}</a>` : '0'}</td>
                <td class="direita">${numero(l.recusados)}</td>
                <td class="direita"><div class="medidor" style="justify-content:flex-end">
                    <div class="medidor__trilha"><div class="medidor__barra" style="width:${((l.taxa_finalizacao ?? 0) * 100).toFixed(1)}%"></div></div>
                    <span class="num pequeno" style="min-width:38px">${percentual(l.taxa_finalizacao)}</span></div></td>
                <td class="direita">${duracaoHoras(l.tempo_medio_horas)}</td>
                <td class="direita">${antigo ? `<span class="idade ${antigo.classe}">${antigo.texto}</span>` : '—'}</td>
            </tr>`;
        }).join('')}</tbody>`;
}

async function abrirEvolucao(profissional) {
    const { el } = abrirModal({
        titulo: profissional,
        descricao: 'Procedimentos recebidos nas últimas 12 semanas, por situação atual.',
        largo: true,
        corpo: '<div class="grafico" id="grafico-evolucao"><div class="esqueleto" style="height:240px"></div></div>',
        rodape: `
            <a class="btn" href="registros.html?profissional=${encodeURIComponent(profissional)}">${icone('registros')}Ver registros</a>
            <a class="btn btn--primario" href="fila.html?profissional=${encodeURIComponent(profissional)}">${icone('fila')}Ver na fila</a>`,
    });
    const { data, error } = await sb.rpc('desempenho_semanal', { p_profissional: profissional, p_semanas: 12 });
    if (error) {
        el.querySelector('#grafico-evolucao').textContent = mensagemErro(error);
        return;
    }
    colunasEmpilhadas(el.querySelector('#grafico-evolucao'), {
        descricao: `Evolução semanal de ${profissional}`,
        series: SERIES,
        dados: data.map(s => ({
            rotulo: diaMes(s.inicio),
            titulo: `Semana de ${diaMes(s.inicio)}`,
            valores: { finalizados: Number(s.finalizados), em_aberto: Number(s.em_aberto), recusados: Number(s.recusados) },
        })),
    });
}

$('tabela').addEventListener('click', (evento) => {
    const ordenar = evento.target.closest('[data-ordenar]');
    if (ordenar) {
        const chave = ordenar.dataset.ordenar;
        ordem = { chave, desc: ordem.chave === chave ? !ordem.desc : chave !== 'profissional' };
        renderizarTabela();
        return;
    }
    const evolucao = evento.target.closest('[data-evolucao]');
    if (evolucao) abrirEvolucao(evolucao.dataset.evolucao);
});
$('periodo').addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-dias]');
    if (!botao) return;
    dias = Number(botao.dataset.dias);
    carregar();
});
$('f-unidade').addEventListener('change', carregar);

carregar();
