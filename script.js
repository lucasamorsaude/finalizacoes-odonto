document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('procedimentoForm');
    const mensagemDiv = document.getElementById('mensagem');
    const profissionalInput = document.getElementById('profissional'); // Referência ao input
    const profissionaisDatalist = document.getElementById('profissionaisList'); // Referência ao datalist

    // **Substitua pela URL do seu Aplicativo da Web do Apps Script**
    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzI_AnXFV0LQzWsWqg9i7B1s0gR6oqBOIbpGYbrBOxNJIPOvFOvneUfwnKX2xP8ITLLhQ/exec';

    // Lista de profissionais para o datalist (pode ser carregada dinamicamente)
    const profissionais = [
        "Dr. Lair Felipe Faria Frederico",
        "Dr. Wesley Gutierre Resende",
        "Dra. Ana Flávia Campos",
        "Dra. Barbara Gleice Souza Pereira",
        "Dra. Eduarda Nascimento Palumbo",
        "Dra. Isabela Fernandes Serpa",
        "Dra. Mariana David Silva",
        "Dra. Mirele Santos Seni",
        "Dra. Nângila Kennya Souza de Carvalho",
        "Dra. Naruna Luany Resende Campos",
        "Dra. Rafaela Carolina Nascimento",
        "Dra. Ana Carolina Ribeiro Pereira",
        "Dr. Wandemberg Gomes Ferreira"
    ];

    // Popula o datalist
    profissionais.forEach(profissional => {
        const option = document.createElement('option');
        option.value = profissional;
        profissionaisDatalist.appendChild(option);
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        mensagemDiv.textContent = 'Registrando...';
        mensagemDiv.style.color = '#007bff'; // Azul para "registrando"

        const paciente = document.getElementById('paciente').value;
        const procedimento = document.getElementById('procedimento').value;
        const profissional = profissionalInput.value; // Pega o valor do input

        // Validação simples para garantir que o profissional selecionado está na lista
        if (!profissionais.includes(profissional)) {
            mensagemDiv.textContent = 'Profissional inválido. Por favor, selecione um da lista.';
            mensagemDiv.style.color = '#dc3545';
            return;
        }

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