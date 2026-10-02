// Formulário público: sempre anônimo; lembra unidade e profissional no aparelho para registros em sequência.
import { sbAnonimo, UNIDADES } from '../supabase.js';
import { icone } from '../icones.js';
import {
    aplicarIcones, preencherSelect, botaoCarregando, mensagemErro, segmentado, botaoTema, ativarTema,
} from '../ui.js';

aplicarIcones();
document.body.insertAdjacentHTML('beforeend', botaoTema('tema-flutuante'));
ativarTema();

const $ = id => document.getElementById(id);
const form = $('form-registro');
const unidade = $('unidade');
const profissional = $('profissional');
const paciente = $('paciente');
const procedimento = $('procedimento');
const mensagem = $('mensagem');

const CHAVE_UNIDADE = 'finaliza:unidade';
const CHAVE_PROFISSIONAL = 'finaliza:profissional';
let registradosNaSessao = 0;

function lembrar(chave) {
    try { return localStorage.getItem(chave) ?? ''; } catch { return ''; }
}
function guardar(chave, valor) {
    try { localStorage.setItem(chave, valor); } catch { /* navegação privada */ }
}

function mostrar(tipo, texto) {
    mensagem.innerHTML = `<p class="mensagem mensagem--${tipo}">${icone(tipo === 'sucesso' ? 'circuloCheck' : 'alerta')}<span></span></p>`;
    mensagem.querySelector('span').textContent = texto;
}

segmentado(unidade, UNIDADES, { valor: lembrar(CHAVE_UNIDADE) });

const { data: profissionais, error } = await sbAnonimo.rpc('listar_profissionais');
if (error) {
    preencherSelect(profissional, [], { vazio: 'Erro ao carregar' });
    mostrar('erro', 'Não foi possível carregar a lista de profissionais. Recarregue a página.');
} else {
    const ultimo = lembrar(CHAVE_PROFISSIONAL);
    preencherSelect(profissional, profissionais, { vazio: 'Selecione', valor: profissionais.includes(ultimo) ? ultimo : '' });
    profissional.disabled = false;
}

// Começa pelo primeiro campo que falta
(!unidade.value ? unidade : !profissional.value ? profissional : paciente).focus();

form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    mensagem.innerHTML = '';

    const valores = {
        p_unidade: unidade.value,
        p_profissional: profissional.value,
        p_paciente: paciente.value.trim(),
        p_procedimento: procedimento.value.trim(),
    };
    const faltando = [
        [unidade, valores.p_unidade], [profissional, valores.p_profissional],
        [paciente, valores.p_paciente], [procedimento, valores.p_procedimento],
    ].find(([, v]) => !v);
    if (faltando) {
        mostrar('erro', 'Preencha todos os campos.');
        faltando[0].focus();
        return;
    }

    const botao = $('registrar');
    botaoCarregando(botao, true, 'Registrando...');
    const { error: erroRegistro } = await sbAnonimo.rpc('registrar_finalizacao', valores);
    botaoCarregando(botao, false);

    if (erroRegistro) {
        mostrar('erro', `Não foi possível registrar: ${mensagemErro(erroRegistro)}`);
        return;
    }

    guardar(CHAVE_UNIDADE, valores.p_unidade);
    guardar(CHAVE_PROFISSIONAL, valores.p_profissional);
    registradosNaSessao++;

    mostrar('sucesso', `Registrado: ${valores.p_paciente}. Pode registrar o próximo.`);
    $('sessao').hidden = false;
    $('sessao').textContent = registradosNaSessao === 1
        ? '1 procedimento registrado nesta sessão.'
        : `${registradosNaSessao} procedimentos registrados nesta sessão.`;

    paciente.value = '';
    procedimento.value = '';
    paciente.focus();
});
