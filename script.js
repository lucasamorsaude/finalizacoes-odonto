document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('procedimentoForm');
    const mensagemDiv = document.getElementById('mensagem');

    // **Substitua pela URL do seu Aplicativo da Web do Apps Script**
    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby0xzgWwljAOiggUZqkxAZOo4MGq8JXEi5n1jWOEl7a_UEmJFs_i2yYnak7GA82Ep0nLQ/exec';

    form.addEventListener('submit', async (event) => {
        event.preventDefault(); // Impede o envio padrão do formulário

        mensagemDiv.textContent = 'Registrando...';
        mensagemDiv.style.color = '#007bff'; // Azul para "registrando"

        const paciente = document.getElementById('paciente').value;
        const procedimento = document.getElementById('procedimento').value;
        const profissional = document.getElementById('profissional').value;

        // Cria um objeto FormData para enviar os dados
        const formData = new FormData();
        formData.append('paciente', paciente);
        formData.append('procedimento', procedimento);
        formData.append('profissional', profissional);

        try {
            const response = await fetch(WEB_APP_URL, {
                method: 'POST',
                body: formData,
            });

            const data = await response.json(); // Espera a resposta JSON do Apps Script

            if (data.status === 'success') {
                mensagemDiv.textContent = 'Procedimento registrado com sucesso!';
                mensagemDiv.style.color = '#28a745'; // Verde para sucesso
                form.reset(); // Limpa o formulário
            } else {
                mensagemDiv.textContent = 'Erro ao registrar: ' + data.message;
                mensagemDiv.style.color = '#dc3545'; // Vermelho para erro
            }
        } catch (error) {
            console.error('Erro na requisição:', error);
            mensagemDiv.textContent = 'Erro de conexão. Tente novamente.';
            mensagemDiv.style.color = '#dc3545';
        }
    });
});