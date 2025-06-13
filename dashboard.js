document.addEventListener('DOMContentLoaded', () => {
    const resultadosDiv = document.getElementById('resultados');
    const dashboardMessageDiv = document.getElementById('dashboardMessage');
    const consultarButton = document.getElementById('consultarButton');
    const filtroProfissionalSelect = document.getElementById('filtroProfissional');
    const logoutButton = document.getElementById('logoutButton');

    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzI_AnXFV0LQzWsWqg9i7B1s0gR6oqBOIbpGYbrBOxNJIPOvFOvneUfwnKX2xP8ITLLhQ/exec';

    const loggedInUser = localStorage.getItem('loggedInUser');

    if (localStorage.getItem('loggedIn') !== 'true' || !loggedInUser) {
        window.location.href = 'login.html';
        return;
    }

    async function loadProfissionais() {
        try {
            const response = await fetch(`${WEB_APP_URL}?action=getProfissionaisFilter`);
            const data = await response.json();

            if (data.status === 'success' && data.profissionais) {
                filtroProfissionalSelect.innerHTML = '<option value="">Todos</option>';
                data.profissionais.forEach(profissional => {
                    const option = document.createElement('option');
                    option.value = profissional;
                    option.textContent = profissional;
                    filtroProfissionalSelect.appendChild(option);
                });
            } else {
                console.error('Erro ao carregar profissionais:', data.message);
                dashboardMessageDiv.textContent = 'Erro ao carregar lista de profissionais.';
                dashboardMessageDiv.style.color = '#dc3545';
            }
        } catch (error) {
            console.error('Erro de conexão ao carregar profissionais:', error);
            dashboardMessageDiv.textContent = 'Erro de conexão ao carregar profissionais.';
            dashboardMessageDiv.style.color = '#dc3545';
        }
    }

    async function fetchData() {
        resultadosDiv.innerHTML = '<p>Carregando dados...</p>';
        dashboardMessageDiv.textContent = '';

        const profissionalSelecionado = filtroProfissionalSelect.value;
        const queryParams = new URLSearchParams();
        
        queryParams.append('usernameLogado', loggedInUser); 
        queryParams.append('action', 'getData');

        if (profissionalSelecionado && profissionalSelecionado !== 'Todos') {
            queryParams.append('profissional', profissionalSelecionado);
        }

        try {
            const response = await fetch(`${WEB_APP_URL}?${queryParams.toString()}`);
            const data = await response.json();

            if (data.status === 'success' && data.data) {
                renderTable(data.headers, data.data);
            } else {
                resultadosDiv.innerHTML = '<p>Nenhum dado encontrado ou erro na consulta.</p>';
                dashboardMessageDiv.textContent = data.message || 'Erro ao consultar dados.';
                dashboardMessageDiv.style.color = '#dc3545';
            }
        } catch (error) {
            console.error('Erro na requisição:', error);
            resultadosDiv.innerHTML = '<p>Erro de conexão. Tente novamente.</p>';
            dashboardMessageDiv.textContent = 'Erro de conexão. Tente novamente.';
            dashboardMessageDiv.style.color = '#dc3545';
        }
    }

    function renderTable(headers, rows) {
        if (rows.length === 0) {
            resultadosDiv.innerHTML = '<p>Nenhum resultado encontrado para o filtro aplicado.</p>';
            return;
        }

        let tableHtml = '<table class="data-table"><thead><tr>';
        headers.forEach(header => {
            tableHtml += `<th>${header}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        rows.forEach(row => {
            tableHtml += '<tr>';
            row.forEach((cell, index) => {
                const headerName = headers[index];

                // Verifica se o cabeçalho da coluna é 'DATA E HORA DE INCLUSÃO' ou similar
                // O nome da coluna pode variar dependendo do que o Apps Script retorna nos headers.
                // Ajuste 'DATA E HORA DE INCLUSÃO' para o nome exato se for diferente.
                if (headerName === 'DATA E HORA DE INCLUSÃO' || headerName === 'Timestamp' || headerName.includes('Data')) {
                    try {
                        const date = new Date(cell);
                        // Formata para data e hora local do Brasil
                        tableHtml += `<td data-label="${headerName}">${date.toLocaleString('pt-BR')}</td>`;
                    } catch (e) {
                        // Se houver erro na conversão (data inválida), exibe o valor original
                        tableHtml += `<td data-label="${headerName}">${cell}</td>`;
                    }
                } else {
                    tableHtml += `<td data-label="${headerName}">${cell}</td>`;
                }
            });
            tableHtml += '</tr>';
        });
        tableHtml += '</tbody></table>';
        resultadosDiv.innerHTML = tableHtml;
    }

    loadProfissionais();
    consultarButton.addEventListener('click', fetchData);
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('loggedInUser');
        window.location.href = 'login.html';
    });
});