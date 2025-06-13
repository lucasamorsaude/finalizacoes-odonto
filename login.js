document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const loginMessageDiv = document.getElementById('loginMessage');
    const backToIndexButton = document.getElementById('backToIndexButton');
    const passwordInput = document.getElementById('password'); // Novo: Referência ao campo de senha
    const togglePassword = document.getElementById('togglePassword'); // Novo: Referência ao ícone do olhinho

    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzI_AnXFV0LQzWsWqg9i7B1s0gR6oqBOIbpGYbrBOxNJIPOvFOvneUfwnKX2xP8ITLLhQ/exec';

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        loginMessageDiv.textContent = 'Verificando...';
        loginMessageDiv.style.color = '#007bff';

        const username = document.getElementById('username').value;
        const password = passwordInput.value; // Usando a referência correta

        const formData = new FormData();
        formData.append('action', 'login');
        formData.append('username', username);
        formData.append('password', password);

        try {
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.status === 'success') {
                loginMessageDiv.textContent = 'Login bem-sucedido!';
                loginMessageDiv.style.color = '#28a745';
                localStorage.setItem('loggedIn', 'true');
                localStorage.setItem('loggedInUser', data.username);
                window.location.href = 'dashboard.html';
            } else {
                loginMessageDiv.textContent = data.message;
                loginMessageDiv.style.color = '#dc3545';
            }
        } catch (error) {
            console.error('Erro na requisição:', error);
            loginMessageDiv.textContent = 'Erro de conexão. Tente novamente.';
            loginMessageDiv.style.color = '#dc3545';
        }
    });

    backToIndexButton.addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    // Novo: Funcionalidade do olhinho para mostrar/esconder a senha
    togglePassword.addEventListener('click', function() {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        this.querySelector('i').classList.toggle('fa-eye');
        this.querySelector('i').classList.toggle('fa-eye-slash');
    });
});