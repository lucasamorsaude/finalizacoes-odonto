import { sb, carregarPerfil, emailDoUsuario, PREFIXO_SENHA } from '../supabase.js';
import { icone } from '../icones.js';
import { aplicarIcones, botaoCarregando, botaoTema, ativarTema } from '../ui.js';

aplicarIcones();
document.body.insertAdjacentHTML('beforeend', botaoTema('tema-flutuante'));
ativarTema();

// Só volta para telas internas do próprio site
const volta = new URLSearchParams(location.search).get('volta');
const destino = volta && /^[a-z]+\.html(\?.*)?$/.test(volta) ? volta : 'fila.html';

if (await carregarPerfil()) location.replace(destino);

const form = document.getElementById('form-login');
const erro = document.getElementById('erro');
const senha = document.getElementById('senha');
const mostrar = document.getElementById('mostrar-senha');

function mostrarErro(texto) {
    erro.innerHTML = `${icone('alerta')}<span></span>`;
    erro.querySelector('span').textContent = texto;
    erro.hidden = false;
}

mostrar.addEventListener('click', () => {
    const visivel = senha.type === 'password';
    senha.type = visivel ? 'text' : 'password';
    mostrar.setAttribute('aria-pressed', String(visivel));
    mostrar.setAttribute('aria-label', visivel ? 'Ocultar senha' : 'Mostrar senha');
    mostrar.innerHTML = icone(visivel ? 'olhoFechado' : 'olho');
});

form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    erro.hidden = true;
    const usuario = document.getElementById('usuario').value;
    if (!usuario.trim() || !senha.value) {
        mostrarErro('Informe usuário e senha.');
        return;
    }

    const botao = document.getElementById('entrar');
    botaoCarregando(botao, true, 'Entrando...');

    const { error } = await sb.auth.signInWithPassword({
        email: emailDoUsuario(usuario),
        password: PREFIXO_SENHA + senha.value,
    });

    if (error) {
        botaoCarregando(botao, false);
        mostrarErro(error.message === 'Invalid login credentials'
            ? 'Usuário ou senha incorretos.'
            : 'Não foi possível entrar. Verifique a conexão e tente de novo.');
        return;
    }

    if (!(await carregarPerfil())) {
        await sb.auth.signOut();
        botaoCarregando(botao, false);
        mostrarErro('Seu acesso está inativo. Fale com a administração.');
        return;
    }

    location.replace(destino);
});
