// Janela de detalhe de um registro: dados, linha do tempo e (admin) alteração de status/observação.
import { sb, STATUS, STATUS_TODOS } from './supabase.js';
import { icone } from './icones.js';
import {
    esc, dataHora, idade, chipStatus, classeStatus, nomeCopiavel, abrirModal, toast, botaoCarregando, mensagemErro,
} from './ui.js';

/**
 * @param item registro de finalizacoes
 * @param opcoes.admin se pode alterar
 * @param opcoes.statusInicial status pré-selecionado (ex.: abrir já em "Recusado")
 * @param opcoes.aoSalvar callback(registroAtualizado)
 */
export function abrirDetalhe(item, { admin = false, statusInicial = null, aoSalvar = null } = {}) {
    const statusEscolhido = statusInicial ?? item.status;
    const aberto = idade(item.created_at);

    const edicao = admin ? `
        <form id="form-status" novalidate>
            <fieldset style="border:0;padding:0;margin:0;display:flex;flex-direction:column;gap:10px">
                <legend class="rotulo" style="margin-bottom:8px">Status</legend>
                <div class="opcoes-status">
                    ${STATUS_TODOS.map(s => `
                        <label class="${classeStatus(s)}">
                            <input type="radio" name="status" value="${esc(s)}" ${s === statusEscolhido ? 'checked' : ''}>
                            ${esc(s)}
                        </label>`).join('')}
                </div>
            </fieldset>
            <div class="campo" style="margin-top:14px">
                <label for="detalhe-obs" id="detalhe-obs-rotulo">Observação</label>
                <textarea id="detalhe-obs" class="entrada" maxlength="1000" placeholder="Visível para o profissional">${esc(item.observacao ?? '')}</textarea>
                <span class="erro-campo" id="detalhe-obs-erro" hidden>Informe o motivo da recusa — o profissional verá este texto.</span>
            </div>
        </form>` : (item.observacao ? `
        <div class="aviso">${icone('mensagem')}<div><strong>Observação da administração</strong><br>${esc(item.observacao)}</div></div>` : '');

    const { el, fechar } = abrirModal({
        titulo: 'Detalhes do registro',
        largo: true,
        corpo: `
            <dl class="detalhes">
                <dt>Paciente</dt><dd>${nomeCopiavel(item.paciente)}</dd>
                <dt>Procedimento</dt><dd>${esc(item.procedimento)}</dd>
                <dt>Profissional</dt><dd>${esc(item.profissional)}</dd>
                <dt>Unidade</dt><dd>${esc(item.unidade)}</dd>
                <dt>Registrado</dt><dd>${dataHora(item.created_at)} <span class="texto-3">(${aberto.texto})</span></dd>
                <dt>Status</dt><dd>${chipStatus(item.status)}</dd>
            </dl>
            ${edicao}
            <section>
                <h3 style="margin-bottom:10px;display:flex;gap:6px;align-items:center">${icone('historico', 'icone--sm')}Histórico</h3>
                <ol class="linha-tempo" id="linha-tempo"><li><span class="texto-3 pequeno">Carregando...</span></li></ol>
            </section>`,
        rodape: admin ? `
            <button type="button" class="btn" data-fechar>Cancelar</button>
            <button type="submit" class="btn btn--primario" form="form-status">${icone('check')}Salvar</button>` : `
            <button type="button" class="btn" data-fechar>Fechar</button>`,
    });

    carregarHistorico(item, el.querySelector('#linha-tempo'));

    if (!admin) return;

    const form = el.querySelector('#form-status');
    const obs = el.querySelector('#detalhe-obs');
    const obsErro = el.querySelector('#detalhe-obs-erro');
    const obsRotulo = el.querySelector('#detalhe-obs-rotulo');

    const statusAtual = () => form.querySelector('input[name="status"]:checked')?.value;
    const ajustarRotulo = () => {
        const recusado = statusAtual() === STATUS.RECUSADO;
        obsRotulo.textContent = recusado ? 'Motivo da recusa (obrigatório)' : 'Observação';
        obs.required = recusado;
        if (!recusado) obsErro.hidden = true;
    };
    form.addEventListener('change', ajustarRotulo);
    ajustarRotulo();
    if (statusInicial === STATUS.RECUSADO) obs.focus();

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const novoStatus = statusAtual();
        const novaObs = obs.value.trim() || null;
        if (novoStatus === STATUS.RECUSADO && !novaObs) {
            obsErro.hidden = false;
            obs.focus();
            return;
        }
        if (novoStatus === item.status && novaObs === (item.observacao ?? null)) {
            fechar();
            return;
        }

        const botao = el.querySelector('button[type="submit"]');
        botaoCarregando(botao, true);
        const { data, error } = await sb.from('finalizacoes')
            .update({ status: novoStatus, observacao: novaObs })
            .eq('id', item.id)
            .select('id, unidade, paciente, procedimento, profissional, status, observacao, created_at, updated_at')
            .single();
        botaoCarregando(botao, false);

        if (error) {
            toast(mensagemErro(error), { tipo: 'erro' });
            return;
        }
        fechar();
        toast(novoStatus === item.status ? 'Observação salva.' : `Status alterado para ${novoStatus}.`);
        aoSalvar?.(data);
    });
}

async function carregarHistorico(item, lista) {
    const { data: eventos, error } = await sb.from('finalizacao_eventos')
        .select('em, autor_nome, status_de, status_para, observacao_de, observacao_para')
        .eq('finalizacao_id', item.id)
        .order('em');

    if (error) {
        lista.innerHTML = '<li><span class="texto-3 pequeno">Não foi possível carregar o histórico.</span></li>';
        return;
    }

    const itens = [`
        <li class="st-pendente">
            <div class="quando">${dataHora(item.created_at)}</div>
            <div class="texto">Registrado por <strong>${esc(item.profissional)}</strong></div>
        </li>`];

    eventos.forEach(e => {
        const autor = e.autor_nome ? ` por <strong>${esc(e.autor_nome)}</strong>` : '';
        const mudouObs = e.observacao_de !== null || e.observacao_para !== null;
        const texto = e.status_para
            ? `${esc(e.status_de)} → <strong>${esc(e.status_para)}</strong>${autor}`
            : `Observação ${e.observacao_para ? 'atualizada' : 'removida'}${autor}`;
        itens.push(`
            <li class="${classeStatus(e.status_para ?? '')}">
                <div class="quando">${dataHora(e.em)}</div>
                <div class="texto">${texto}</div>
                ${mudouObs && e.observacao_para ? `<div class="obs-evento">${esc(e.observacao_para)}</div>` : ''}
            </li>`);
    });

    if (!eventos.length && item.status !== STATUS.PENDENTE) {
        itens.push(`
            <li class="${classeStatus(item.status)}">
                <div class="quando">Antes da migração</div>
                <div class="texto">Status atual: <strong>${esc(item.status)}</strong> (alterado na planilha)</div>
            </li>`);
    }

    lista.innerHTML = itens.join('');
}
