// Layout comum das telas autenticadas: guarda de sessão/papel, menu lateral e "Nova finalização".
// Cada página tem <main class="conteudo" hidden> com o próprio conteúdo; aqui ele é encaixado no layout.
import { sb, carregarPerfil, sair, UNIDADES, STATUS_ABERTOS } from './supabase.js';
import { icone } from './icones.js';
import { esc, iniciais, abrirModal, toast, botaoCarregando, preencherSelect, mensagemErro } from './ui.js';

const ITENS_MENU = [
    { tela: 'fila', href: 'fila.html', rotulo: 'Fila', icone: 'fila' },
    { tela: 'painel', href: 'painel.html', rotulo: 'Painel', icone: 'painel' },
    { tela: 'desempenho', href: 'desempenho.html', rotulo: 'Desempenho', icone: 'desempenho', admin: true },
    { tela: 'registros', href: 'registros.html', rotulo: 'Registros', icone: 'registros' },
    { tela: 'usuarios', href: 'usuarios.html', rotulo: 'Usuários', icone: 'usuarios', admin: true },
];

let perfilAtual = null;

export async function iniciarApp({ tela, somenteAdmin = false }) {
    const perfil = await carregarPerfil();
    if (!perfil) {
        const volta = encodeURIComponent(location.pathname.split('/').pop() + location.search);
        location.replace(`login.html?volta=${volta}`);
        return new Promise(() => {}); // a página não continua
    }
    if (somenteAdmin && !perfil.is_admin) {
        location.replace('fila.html');
        return new Promise(() => {});
    }
    perfilAtual = perfil;

    montarLayout(perfil, tela);
    atualizarContadorFila();

    sb.auth.onAuthStateChange((evento) => {
        if (evento === 'SIGNED_OUT') location.replace('login.html');
    });

    return perfil;
}

function montarLayout(perfil, telaAtiva) {
    const conteudo = document.querySelector('main.conteudo');
    const itens = ITENS_MENU.filter(item => !item.admin || perfil.is_admin);
    const nomeExibido = perfil.is_admin ? perfil.username : perfil.profissional;

    const app = document.createElement('div');
    app.className = 'app';
    app.innerHTML = `
        <aside class="lateral" id="lateral" aria-label="Navegação">
            <a class="marca" href="fila.html">
                <img src="assets/img/logo.svg" alt="">
                <div><strong>Finaliza Odonto</strong><span>AmorSaúde São João del-Rei</span></div>
            </a>
            <nav class="nav">
                ${itens.map(item => `
                    <a href="${item.href}" ${item.tela === telaAtiva ? 'aria-current="page"' : ''}>
                        ${icone(item.icone)}<span>${item.rotulo}</span>
                        ${item.tela === 'fila' ? '<span class="contador" data-contador-fila hidden></span>' : ''}
                    </a>`).join('')}
            </nav>
            <button type="button" class="btn btn--primario btn--nova" data-nova-finalizacao>
                ${icone('mais')}Nova finalização
            </button>
            <div class="usuario">
                <div class="avatar" aria-hidden="true">${esc(iniciais(nomeExibido))}</div>
                <div>
                    <strong title="${esc(nomeExibido)}">${esc(nomeExibido)}</strong>
                    <span>${perfil.is_admin ? 'Administrador' : 'Profissional'}</span>
                </div>
                <button type="button" class="btn btn--fantasma btn--icone btn--sm" data-sair aria-label="Sair" title="Sair">${icone('sair')}</button>
            </div>
        </aside>
        <div class="principal">
            <header class="topo-movel">
                <button type="button" class="btn btn--fantasma btn--icone" data-abrir-menu aria-label="Abrir menu" aria-controls="lateral" aria-expanded="false">${icone('menu')}</button>
                <a class="marca" href="fila.html"><img src="assets/img/logo.svg" alt=""><div><strong>Finaliza Odonto</strong></div></a>
                <button type="button" class="btn btn--primario btn--icone" data-nova-finalizacao aria-label="Nova finalização">${icone('mais')}</button>
            </header>
        </div>`;

    app.querySelector('.principal').append(conteudo);
    document.body.prepend(app);
    conteudo.hidden = false;

    app.querySelectorAll('[data-sair]').forEach(b => b.addEventListener('click', sair));
    app.querySelectorAll('[data-nova-finalizacao]').forEach(b => b.addEventListener('click', abrirNovaFinalizacao));

    // Menu no celular
    const lateral = app.querySelector('.lateral');
    const botaoMenu = app.querySelector('[data-abrir-menu]');
    let veu = null;
    const fecharMenu = () => {
        lateral.classList.remove('aberta');
        botaoMenu.setAttribute('aria-expanded', 'false');
        veu?.remove();
        veu = null;
    };
    botaoMenu.addEventListener('click', () => {
        lateral.classList.add('aberta');
        botaoMenu.setAttribute('aria-expanded', 'true');
        veu = document.createElement('div');
        veu.className = 'veu';
        veu.addEventListener('click', fecharMenu);
        document.body.append(veu);
        lateral.querySelector('a')?.focus();
    });
    document.addEventListener('keydown', (evento) => {
        if (evento.key === 'Escape' && lateral.classList.contains('aberta')) fecharMenu();
    });
}

// Número de itens abertos visíveis para o usuário (todos, para admin; os seus, para profissional)
export async function atualizarContadorFila() {
    const { count } = await sb.from('finalizacoes')
        .select('id', { count: 'exact', head: true })
        .in('status', STATUS_ABERTOS);
    document.querySelectorAll('[data-contador-fila]').forEach(el => {
        el.hidden = !count;
        el.textContent = count > 999 ? '999+' : String(count ?? '');
    });
}

// ── Nova finalização ───────────────────────────────────────────────────────

async function abrirNovaFinalizacao() {
    const perfil = perfilAtual;
    const unidadePadrao = perfil.unidade || localStorage.getItem('finaliza:unidade') || '';

    const { el, fechar } = abrirModal({
        titulo: 'Nova finalização',
        descricao: perfil.is_admin
            ? 'Registre um procedimento concluído para entrar na fila.'
            : `Registrado em nome de <strong>${esc(perfil.profissional)}</strong>.`,
        corpo: `
            <form id="form-nova" class="modal__form" novalidate>
                <div class="campo">
                    <label for="nova-unidade">Unidade</label>
                    <select id="nova-unidade" class="entrada" required></select>
                </div>
                ${perfil.is_admin ? `
                <div class="campo">
                    <label for="nova-profissional">Profissional</label>
                    <select id="nova-profissional" class="entrada" required><option value="">Carregando...</option></select>
                </div>` : ''}
                <div class="campo">
                    <label for="nova-paciente">Nome do paciente</label>
                    <input id="nova-paciente" class="entrada" required autocomplete="off" maxlength="200" autofocus>
                </div>
                <div class="campo">
                    <label for="nova-procedimento">Procedimento</label>
                    <textarea id="nova-procedimento" class="entrada" required maxlength="2000" placeholder="Ex.: restauração dente 26, limpeza bonificada"></textarea>
                </div>
                <p class="mensagem mensagem--erro" id="nova-erro" hidden></p>
            </form>`,
        rodape: `
            <button type="button" class="btn" data-fechar>Cancelar</button>
            <button type="submit" class="btn btn--primario" form="form-nova">${icone('enviar')}Registrar</button>`,
    });

    const form = el.querySelector('#form-nova');
    const selUnidade = el.querySelector('#nova-unidade');
    const selProf = el.querySelector('#nova-profissional');
    const erro = el.querySelector('#nova-erro');
    form.style.cssText = 'display:flex;flex-direction:column;gap:14px';
    preencherSelect(selUnidade, UNIDADES, { vazio: 'Selecione', valor: unidadePadrao });

    if (selProf) {
        const { data } = await sb.rpc('listar_profissionais');
        preencherSelect(selProf, data ?? [], { vazio: 'Selecione' });
    }

    form.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const valores = {
            p_unidade: selUnidade.value,
            p_paciente: el.querySelector('#nova-paciente').value.trim(),
            p_procedimento: el.querySelector('#nova-procedimento').value.trim(),
            p_profissional: selProf ? selProf.value : perfil.profissional,
        };
        if (Object.values(valores).some(v => !v)) {
            erro.textContent = 'Preencha todos os campos.';
            erro.hidden = false;
            return;
        }

        const botao = el.querySelector('button[type="submit"]');
        botaoCarregando(botao, true, 'Registrando...');
        const { error } = await sb.rpc('registrar_finalizacao', valores);
        botaoCarregando(botao, false);

        if (error) {
            erro.textContent = mensagemErro(error);
            erro.hidden = false;
            return;
        }
        localStorage.setItem('finaliza:unidade', valores.p_unidade);
        fechar();
        toast('Finalização registrada e enviada para a fila.');
        atualizarContadorFila();
        document.dispatchEvent(new CustomEvent('finalizacao-registrada'));
    });
}
