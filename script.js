document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('procedimentoForm');
    const mensagemDiv = document.getElementById('mensagem');
    const profissionalInput = document.getElementById('profissional');
    const profissionaisDatalist = document.getElementById('profissionaisList');
    const submitButton = form.querySelector('button[type="submit"]');

    let profissionaisValidos = [];

    // Bloqueia o campo até os profissionais carregarem
    profissionalInput.disabled = true;
    profissionalInput.placeholder = 'Carregando profissionais...';

    async function loadProfissionais() {
        const { data, error } = await sb.rpc('listar_profissionais');

        if (error) {
            console.error('Erro ao carregar profissionais:', error);
            profissionalInput.placeholder = 'Erro de conexão — recarregue a página';
            return;
        }

        profissionaisValidos = data;
        profissionaisDatalist.innerHTML = '';
        data.forEach(prof => {
            const option = document.createElement('option');
            option.value = prof;
            profissionaisDatalist.appendChild(option);
        });
        profissionalInput.disabled = false;
        profissionalInput.placeholder = 'Digite ou selecione o profissional';
    }

    loadProfissionais();

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const profissional = profissionalInput.value;

        if (!profissionaisValidos.includes(profissional)) {
            mensagemDiv.textContent = 'Profissional inválido. Por favor, selecione um da lista.';
            mensagemDiv.style.color = '#dc3545';
            return;
        }

        mensagemDiv.textContent = 'Registrando...';
        mensagemDiv.style.color = '#007bff';
        submitButton.disabled = true;

        const { error } = await sb.rpc('registrar_finalizacao', {
            p_unidade: document.getElementById('unidade').value,
            p_paciente: document.getElementById('paciente').value,
            p_procedimento: document.getElementById('procedimento').value,
            p_profissional: profissional,
        });

        submitButton.disabled = false;

        if (error) {
            console.error('Erro ao registrar:', error);
            mensagemDiv.textContent = 'Erro ao registrar: ' + error.message;
            mensagemDiv.style.color = '#dc3545';
            return;
        }

        mensagemDiv.textContent = 'Procedimento registrado com sucesso!';
        mensagemDiv.style.color = '#28a745';
        form.reset();
    });
});
