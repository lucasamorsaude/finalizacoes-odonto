document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('loginForm');
    const loginMessageDiv = document.getElementById('loginMessage');
    const backToIndexButton = document.getElementById('backToIndexButton');
    const passwordInput = document.getElementById('password');
    const togglePassword = document.getElementById('togglePassword');

    // Já logado: vai direto para o dashboard
    if (await carregarPerfil()) {
        window.location.href = 'dashboard.html';
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        loginMessageDiv.textContent = 'Verificando...';
        loginMessageDiv.style.color = '#007bff';

        const { error } = await sb.auth.signInWithPassword({
            email: emailDoUsuario(document.getElementById('username').value),
            password: PREFIXO_SENHA + passwordInput.value,
        });

        if (error) {
            console.error('Erro no login:', error);
            loginMessageDiv.textContent = error.message === 'Invalid login credentials'
                ? 'Usuário ou senha inválidos.'
                : 'Erro de conexão. Tente novamente.';
            loginMessageDiv.style.color = '#dc3545';
            return;
        }

        const perfil = await carregarPerfil();
        if (!perfil) {
            await sb.auth.signOut();
            loginMessageDiv.textContent = 'Usuário inativo. Contate o administrador.';
            loginMessageDiv.style.color = '#dc3545';
            return;
        }

        loginMessageDiv.textContent = 'Login bem-sucedido!';
        loginMessageDiv.style.color = '#28a745';
        window.location.href = 'dashboard.html';
    });

    backToIndexButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.querySelector('i').classList.toggle('fa-eye');
        this.querySelector('i').classList.toggle('fa-eye-slash');
    });
});
