// Painel: indicadores do período, itens em aberto por idade, série e comparação por unidade.
import { iniciarApp } from '../app.js';
import { sb, UNIDADES } from '../supabase.js';
import { colunasEmpilhadas, barraFaixas } from '../graficos.js';
import {
    esc, numero, percentual, duracaoHoras, data, diaMes, idade, ultimosDias, lerParametros, gravarParametros,
    preencherSelect, aplicarIcones, toast, mensagemErro, segmentado,
} from '../ui.js';

aplicarIcones();
const perfil = await iniciarApp({ tela: 'painel' });
const admin = perfil.is_admin;

const $ = id => document.getElementById(id);
const PERIODOS = [7, 30, 90, 365];
const SERIES = [
    { chave: 'finalizados', nome: 'Finalizados', cor: 'var(--serie-1)' },
    { chave: 'em_aberto', nome: 'Em aberto', cor: 'var(--serie-2)' },
    { chave: 'recusados', nome: 'Recusados', cor: 'var(--serie-3)' },
];

const params = lerParametros();
let dias = PERIODOS.includes(Number(params.periodo)) ? Number(params.periodo) : 30;

segmentado($('f-unidade'), [['', 'Todas'], ...UNIDADES], { valor: params.unidade ?? '' });
if (admin) {
    $('campo-profissional').hidden = false;
    const { data: nomes } = await sb.rpc('profissionais_registrados');
    preencherSelect($('f-profissional'), nomes ?? [], { vazio: 'Todos', valor: params.profissional ?? '' });
} else {
    $('titulo').textContent = 'Meu painel';
    $('subtitulo').textContent = `Números dos registros de ${perfil.profissional}.`;
}

function marcarPeriodo() {
    $('periodo').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.dias) === dias)));
}

async function carregar() {
    marcarPeriodo();
    const unidade = $('f-unidade').value || null;
    const profissional = admin ? ($('f-profissional').value || null) : null;
    gravarParametros({ periodo: dias === 30 ? null : dias, unidade, profissional });

    const { de, ate } = ultimosDias(dias);
    const filtros = { p_de: de, p_ate: ate, p_unidade: unidade, p_profissional: profissional };
    $('painel').classList.add('recarregando');

    const [indicadores, serie] = await Promise.all([
        sb.rpc('painel_indicadores', filtros),
        sb.rpc('painel_serie', filtros),
    ]);

    $('painel').classList.remove('recarregando');
    const erro = indicadores.error ?? serie.error;
    if (erro) {
        toast(mensagemErro(erro), { tipo: 'erro' });
        return;
    }

    renderizar(indicadores.data, serie.data, { unidade, profissional });
}

function renderizar(ind, serie, { unidade, profissional }) {
    const aberto = ind.aberto_agora;
    $('aberto-total').textContent = numero(aberto.total);
    $('aberto-antigo').textContent = aberto.mais_antigo
        ? `O mais antigo está na fila ${idade(aberto.mais_antigo).texto} (desde ${data(aberto.mais_antigo)}).`
        : 'Nenhum item aguardando.';
    const linkFila = new URLSearchParams();
    if (unidade) linkFila.set('unidade', unidade);
    if (profissional) linkFila.set('profissional', profissional);
    document.querySelector('a[href^="fila.html"]').href = `fila.html${linkFila.size ? '?' + linkFila : ''}`;

    barraFaixas($('grafico-faixas'), {
        descricao: 'Itens em aberto por tempo na fila',
        faixas: [
            { nome: 'Até 7 dias', valor: aberto.ate_7, cor: 'var(--ordinal-1)' },
            { nome: '7 a 30 dias', valor: aberto.de_7_a_30, cor: 'var(--ordinal-2)' },
            { nome: '30 a 90 dias', valor: aberto.de_30_a_90, cor: 'var(--ordinal-3)' },
            { nome: 'Mais de 90 dias', valor: aberto.acima_90, cor: 'var(--ordinal-4)' },
        ],
    });

    const amostra = Number(ind.tempo_medio_amostra);
    const kpis = [
        { rotulo: 'Recebidos', valor: numero(ind.recebidos), detalhe: `nos últimos ${dias === 365 ? '12 meses' : dias + ' dias'}` },
        { rotulo: 'Finalizados', valor: numero(ind.finalizados), detalhe: `${percentual(ind.taxa_finalizacao)} dos recebidos` },
        { rotulo: 'Ainda em aberto', valor: numero(ind.em_aberto), detalhe: 'dos recebidos no período' },
        { rotulo: 'Recusados', valor: numero(ind.recusados), detalhe: 'não serão finalizados' },
        {
            rotulo: 'Tempo até finalizar',
            valor: amostra ? duracaoHoras(ind.tempo_medio_horas) : '—',
            detalhe: amostra ? `média · mediana ${duracaoHoras(ind.tempo_mediano_horas)} · ${numero(amostra)} finalizações` : 'sem finalizações medidas ainda',
        },
    ];
    $('kpis').innerHTML = kpis.map(k => `
        <div class="cartao kpi">
            <span class="rotulo">${esc(k.rotulo)}</span>
            <span class="valor">${esc(k.valor)}</span>
            <span class="detalhe">${esc(k.detalhe)}</span>
        </div>`).join('');

    const semanal = dias > 45;
    $('titulo-serie').textContent = semanal ? 'Recebidos por semana' : 'Recebidos por dia';
    colunasEmpilhadas($('grafico-serie'), {
        descricao: `Recebidos por ${semanal ? 'semana' : 'dia'}, por situação atual`,
        series: SERIES,
        dados: serie.map(r => ({
            rotulo: diaMes(r.inicio),
            titulo: semanal ? `Semana de ${diaMes(r.inicio)}` : diaMes(r.inicio),
            valores: { finalizados: Number(r.finalizados), em_aberto: Number(r.em_aberto), recusados: Number(r.recusados) },
        })),
    });

    $('por-unidade').innerHTML = ind.por_unidade.length
        ? `<ul class="lista-unidades">${ind.por_unidade.map(u => {
            const taxa = u.recebidos ? u.finalizados / u.recebidos : 0;
            return `<li>
                <div class="lista-unidades__topo"><strong>${esc(u.unidade)}</strong><span class="num">${numero(u.recebidos)} recebidos</span></div>
                <div class="medidor"><div class="medidor__trilha"><div class="medidor__barra" style="width:${(taxa * 100).toFixed(1)}%"></div></div></div>
                <div class="lista-unidades__rodape"><span>${percentual(taxa)} finalizados</span><span>${numero(u.em_aberto)} em aberto · ${numero(u.recusados)} recusados</span></div>
            </li>`;
        }).join('')}</ul>`
        : '<p class="texto-3 pequeno">Nenhum registro no período.</p>';

    const aviso = $('aviso-tempo');
    aviso.hidden = amostra > 0;
    aviso.textContent = 'O tempo até finalizar é medido a partir das finalizações feitas no sistema novo. '
        + 'Registros vindos da planilha não têm essa informação.';
}

$('periodo').addEventListener('click', (evento) => {
    const botao = evento.target.closest('[data-dias]');
    if (!botao) return;
    dias = Number(botao.dataset.dias);
    carregar();
});
$('f-unidade').addEventListener('change', carregar);
$('f-profissional').addEventListener('change', carregar);

carregar();
