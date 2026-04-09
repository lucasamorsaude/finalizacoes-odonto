document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('procedimentoForm');
    const mensagemDiv = document.getElementById('mensagem');
    const profissionalInput = document.getElementById('profissional');
    const profissionaisDatalist = document.getElementById('profissionaisList');

    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzZ4pDx74e82rT2TJQevF-DB-cKGIuzPvTQASLqytmA0AyRivmjgvuprlAOI3ye2zpySQ/exec';

    let profissionaisValidos = [];

    // Bloqueia o campo até os profissionais carregarem
    profissionalInput.disabled = true;
    profissionalInput.placeholder = 'Carregando profissionais...';

    async function loadProfissionais() {
        try {
            const response = await fetch(`${WEB_APP_URL}?action=getProfissionais`);
            const data = await response.json();

            if (data.status === 'success' && data.profissionais) {
                profissionaisValidos = data.profissionais;
                profissionaisDatalist.innerHTML = '';
                data.profissionais.forEach(prof => {
                    const option = document.createElement('option');
                    option.value = prof;
                    profissionaisDatalist.appendChild(option);
                });
                profissionalInput.disabled = false;
                profissionalInput.placeholder = 'Digite ou selecione o profissional';
            } else {
                profissionalInput.placeholder = 'Erro ao carregar profissionais';
            }
        } catch (error) {
            console.error('Erro ao carregar profissionais:', error);
            profissionalInput.placeholder = 'Erro de conexão — recarregue a página';
        }
    }

    loadProfissionais();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        mensagemDiv.textContent = 'Registrando...';
        mensagemDiv.style.color = '#007bff';

        const unidade = document.getElementById('unidade').value;
        const paciente = document.getElementById('paciente').value;
        const procedimento = document.getElementById('procedimento').value;
        const profissional = profissionalInput.value;

        if (!profissionaisValidos.includes(profissional)) {
            mensagemDiv.textContent = 'Profissional inválido. Por favor, selecione um da lista.';
            mensagemDiv.style.color = '#dc3545';
            return;
        }

        const formData = new FormData();
        formData.append('unidade', unidade);
        formData.append('paciente', paciente);
        formData.append('procedimento', procedimento);
        formData.append('profissional', profissional);

        try {
            const response = await fetch(WEB_APP_URL, { method: 'POST', body: formData });
            const data = await response.json();

            if (data.status === 'success') {
                mensagemDiv.textContent = 'Procedimento registrado com sucesso!';
                mensagemDiv.style.color = '#28a745';
                form.reset();
            } else {
                mensagemDiv.textContent = 'Erro ao registrar: ' + data.message;
                mensagemDiv.style.color = '#dc3545';
            }
        } catch (error) {
            console.error('Erro na requisição:', error);
            mensagemDiv.textContent = 'Erro de conexão. Tente novamente.';
            mensagemDiv.style.color = '#dc3545';
        }
    });
});
