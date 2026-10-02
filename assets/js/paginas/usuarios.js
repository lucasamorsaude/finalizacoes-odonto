// Gestão de usuários (somente admin). Criar login e trocar senha passam pela Edge Function admin-usuarios.
import { iniciarApp } from '../app.js';
import { sb, UNIDADES, normalizarUsuario } from '../supabase.js';
import { icone } from '../icones.js';
import {
    esc, iniciais, abrirModal, toast, botaoCarregando, mensagemErro, aplicarIcones, vazio, falha, segmentado,
} from '../ui.js';

aplicarIcones();
const perfil = await iniciarApp({ tela: 'usuarios', somenteAdmin: true });

const $ = id => document.getElementById(id);
let usuarios = [];

async function carregar() {
    const { data, error } = await sb.from('usuarios')
        .select('id, username, profissional, unidade, ativo, is_admin')
        .order('profissional');
    if (error) {
        $('tabela').innerHTML = `<tbody><tr><td>${falha(mensagemErro(error))}</td></tr></tbody>`;
        return;
    }
    usuarios = data;
    renderizar();
}

function renderizar() {
    const termo = normalizarUsuario($('f-busca').value);
    const situacao = $('f-situacao').value;
    const visiveis = usuarios.filter(u =>
        (!situacao || (situacao === 'ativos' ? u.ativo : !u.ativo))
        && (!termo || normalizarUsuario(`${u.profissional} ${u.username}`).includes(termo)));

    if (!visiveis.length) {
        $('tabela').innerHTML = `<tbody><tr><td>${vazio({ icone: 'usuarios', titulo: 'Nenhum usuário encontrado' })}</td></tr></tbody>`;
        return;
    }

    $('tabela').innerHTML = `
        <thead><tr><th>Nome</th><th>Login</th><th>Unidade</th><th>Perfil</th><th>Situação</th><th class="direita">Ações</th></tr></thead>
        <tbody>${visiveis.map(u => {
            const voce = u.id === perfil.id;
            return `<tr>
                <td><div style="display:flex;align-items:center;gap:10px">
                    <span class="avatar" aria-hidden="true">${esc(iniciais(u.is_admin ? u.username : u.profissional))}</span>
                    <strong>${esc(u.profissional)}</strong>${voce ? '<span class="texto-3 pequeno">(você)</span>' : ''}
                </div></td>
                <td class="texto-2">${esc(u.username)}</td>
                <td>${esc(u.unidade ?? '—')}</td>
                <td>${u.is_admin ? `<span class="status st-liberacao">${icone('escudo')}Administrador</span>` : 'Profissional'}</td>
                <td>${u.ativo ? `<span class="status st-finalizado">${icone('circuloCheck')}Ativo</span>` : `<span class="status st-recusado">${icone('proibido')}Inativo</span>`}</td>
                <td class="direita" style="white-space:nowrap">
                    <button type="button" class="btn btn--sm" data-editar="${u.id}">${icone('lapis', 'icone--sm')}Editar</button>
                    ${voce ? '' : `<button type="button" class="btn btn--sm ${u.ativo ? 'btn--perigo' : ''}" data-alternar="${u.id}">${icone('energia', 'icone--sm')}${u.ativo ? 'Inativar' : 'Ativar'}</button>`}
                </td>
            </tr>`;
        }).join('')}</tbody>`;
}

async function chamarFuncao(corpo) {
    const { data, error } = await sb.functions.invoke('admin-usuarios', { body: corpo });
    if (!error) return { mensagem: data.mensagem };
    const detalhe = await error.context?.json?.().catch(() => null);
    return { erro: detalhe?.erro || 'Não foi possível concluir. Verifique a conexão.' };
}

function abrirFormulario(usuario = null) {
    const editando = Boolean(usuario);
    const ehVoce = usuario?.id === perfil.id;
    const { el, fechar } = abrirModal({
        titulo: editando ? 'Editar usuário' : 'Novo usuário',
        descricao: editando ? `Login: <strong>${esc(usuario.username)}</strong>` : 'O login e a senha serão usados para entrar no sistema.',
        corpo: `
            <form id="form-usuario" novalidate style="display:flex;flex-direction:column;gap:14px">
                ${editando ? '' : `
                <div class="campo">
                    <label for="u-login">Login</label>
                    <input id="u-login" class="entrada" required autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="ex.: dra.ana">
                    <span class="ajuda" id="u-login-ajuda">Letras, números, ponto, hífen ou _. Acentos e espaços são ajustados.</span>
                </div>`}
                <div class="campo">
                    <label for="u-nome">Nome do profissional</label>
                    <input id="u-nome" class="entrada" required maxlength="120" placeholder="Ex.: Dra. Ana Carolina Ribeiro" value="${esc(usuario?.profissional ?? '')}">
                    ${editando ? '<span class="ajuda">Registros antigos continuam com o nome anterior.</span>' : ''}
                </div>
                <div class="campo">
                    <span class="rotulo" id="rotulo-u-unidade">Unidade</span>
                    <div id="u-unidade" class="segmentado--bloco" aria-labelledby="rotulo-u-unidade"></div>
                </div>
                <div class="campo">
                    <label for="u-senha">${editando ? 'Nova senha' : 'Senha'}</label>
                    <input id="u-senha" class="entrada" type="text" autocomplete="new-password" ${editando ? 'placeholder="Deixe em branco para manter a atual"' : 'required'}>
                </div>
                <label style="display:flex;gap:10px;align-items:flex-start;cursor:pointer">
                    <input type="checkbox" class="caixa" id="u-admin" ${usuario?.is_admin ? 'checked' : ''} ${ehVoce ? 'disabled' : ''} style="margin-top:2px">
                    <span><strong>Administrador</strong><br><span class="texto-2 pequeno">Finaliza procedimentos, vê todos os registros e gerencia usuários.</span></span>
                </label>
                <p class="mensagem mensagem--erro" id="u-erro" hidden></p>
            </form>`,
        rodape: `<button type="button" class="btn" data-fechar>Cancelar</button>
                 <button type="submit" class="btn btn--primario" form="form-usuario">${icone('check')}Salvar</button>`,
    });

    segmentado(el.querySelector('#u-unidade'), [['', 'Nenhuma'], ...UNIDADES], { valor: usuario?.unidade ?? '' });
    const erro = el.querySelector('#u-erro');
    const mostrarErro = (texto) => { erro.textContent = texto; erro.hidden = false; };

    const login = el.querySelector('#u-login');
    login?.addEventListener('input', () => {
        const normalizado = normalizarUsuario(login.value);
        el.querySelector('#u-login-ajuda').textContent = normalizado && normalizado !== login.value
            ? `Será criado como: ${normalizado}` : 'Letras, números, ponto, hífen ou _. Acentos e espaços são ajustados.';
    });

    el.querySelector('#form-usuario').addEventListener('submit', async (evento) => {
        evento.preventDefault();
        erro.hidden = true;
        const nome = el.querySelector('#u-nome').value.trim();
        const unidade = el.querySelector('#u-unidade').value || null;
        const senha = el.querySelector('#u-senha').value;
        const isAdmin = el.querySelector('#u-admin').checked;
        if (!nome) return mostrarErro('Informe o nome do profissional.');
        if (!editando && (!login.value.trim() || !senha)) return mostrarErro('Informe login e senha.');

        const botao = el.querySelector('button[type="submit"]');
        botaoCarregando(botao, true);

        if (!editando) {
            const { erro: falhou, mensagem } = await chamarFuncao({
                acao: 'criar', username: login.value, senha, profissional: nome, unidade, is_admin: isAdmin,
            });
            botaoCarregando(botao, false);
            if (falhou) return mostrarErro(falhou);
            toast(mensagem);
        } else {
            const { error } = await sb.from('usuarios')
                .update({ profissional: nome, unidade, is_admin: isAdmin })
                .eq('id', usuario.id);
            if (error) {
                botaoCarregando(botao, false);
                return mostrarErro(mensagemErro(error));
            }
            if (senha) {
                const { erro: falhou } = await chamarFuncao({ acao: 'senha', id: usuario.id, senha });
                if (falhou) {
                    botaoCarregando(botao, false);
                    return mostrarErro(`Dados salvos, mas a senha não foi alterada: ${falhou}`);
                }
            }
            botaoCarregando(botao, false);
            toast('Usuário atualizado.');
        }
        fechar();
        carregar();
    });
}

async function alternarAtivo(usuario) {
    const ativar = !usuario.ativo;
    const { el, fechar } = abrirModal({
        titulo: ativar ? 'Ativar usuário?' : 'Inativar usuário?',
        descricao: ativar
            ? `${esc(usuario.profissional)} voltará a acessar o sistema e a aparecer no formulário.`
            : `${esc(usuario.profissional)} perde o acesso e sai do formulário de registro. Os registros antigos continuam.`,
        rodape: `<button type="button" class="btn" data-fechar>Cancelar</button>
                 <button type="button" class="btn ${ativar ? 'btn--primario' : 'btn--perigo-cheio'}" id="confirmar">${ativar ? 'Ativar' : 'Inativar'}</button>`,
    });
    el.querySelector('#confirmar').addEventListener('click', async (evento) => {
        botaoCarregando(evento.currentTarget, true);
        const { error } = await sb.from('usuarios').update({ ativo: ativar }).eq('id', usuario.id);
        fechar();
        if (error) return toast(mensagemErro(error), { tipo: 'erro' });
        toast(`${usuario.profissional} ${ativar ? 'ativado' : 'inativado'}.`);
        carregar();
    });
}

$('tabela').addEventListener('click', (evento) => {
    const editar = evento.target.closest('[data-editar]');
    const alternar = evento.target.closest('[data-alternar]');
    if (editar) abrirFormulario(usuarios.find(u => u.id === editar.dataset.editar));
    if (alternar) alternarAtivo(usuarios.find(u => u.id === alternar.dataset.alternar));
    if (evento.target.closest('[data-tentar-de-novo]')) carregar();
});
$('novo').addEventListener('click', () => abrirFormulario());
$('f-busca').addEventListener('input', renderizar);
$('f-situacao').addEventListener('change', renderizar);

carregar();
