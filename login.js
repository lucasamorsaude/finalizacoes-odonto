document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('loginForm');
    const loginMessageDiv = document.getElementById('loginMessage');
    const backToIndexButton = document.getElementById('backToIndexButton'); // NOVO: Obter o botão

    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbx0xzgWwljAOiggUZqkxAZOo4MGq8JXEi5n1jWOEl7a_UEmJFs_i2yYnak7GA82Ep0nLQ/exec'; // **VERIFIQUE SE ESTA URL ESTÁ ATUALIZADA COM A SUA**

    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Impede o envio padrão do formulário

        loginMessageDiv.textContent = 'Verificando...';
        loginMessageDiv.style.color = '#007bff';

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const formData = new FormData();
        formData.append('action', 'login'); // Indica ao Apps Script que é uma ação de login
        formData.append('username', username);
        formData.append('password', password);

        try {
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json(); // Espera a resposta JSON do Apps Script

            if (data.status === 'success') {
                loginMessageDiv.textContent = 'Login bem-sucedido!';
                loginMessageDiv.style.color = '#28a745';
                // Armazena um token ou status de login no localStorage para persistência
                localStorage.setItem('loggedIn', 'true');
                localStorage.setItem('loggedInUser', data.username); // Armazena o nome de usuário
                window.location.href = 'dashboard.html'; // Redireciona para a tela de consulta
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

    // NOVO: Adicionar o event listener para o botão "Voltar para Início"
    backToIndexButton.addEventListener('click', () => {
        window.location.href = 'index.html'; // Redireciona para a tela de registro
    });
});