document.addEventListener('DOMContentLoaded', () => {
    const resultadosDiv = document.getElementById('resultados');
    const dashboardMessageDiv = document.getElementById('dashboardMessage');
    const consultarButton = document.getElementById('consultarButton');
    const filtroProfissionalSelect = document.getElementById('filtroProfissional');
    const logoutButton = document.getElementById('logoutButton');

    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycby0xzgWwljAOiggUZqkxAZOo4MGq8JXEi5n1jWOEl7a_UEmJFs_i2yYnak7GA82Ep0nLQ/exec'; // **VERIFIQUE SE ESTA URL ESTÁ ATUALIZADA COM A SUA**

    const loggedInUser = localStorage.getItem('loggedInUser'); // Obtém o usuário curto logado

    if (localStorage.getItem('loggedIn') !== 'true' || !loggedInUser) {
        window.location.href = 'login.html';
        return;
    }

    // Exibir o nome do usuário logado (opcional)
    // const welcomeMessage = document.createElement('p');
    // welcomeMessage.textContent = `Bem-vindo(a), ${loggedInUser}!`;
    // resultadosDiv.before(welcomeMessage); // Adiciona antes dos resultados

    async function loadProfissionais() {
        try {
            const response = await fetch(`${WEB_APP_URL}?action=getProfissionais`);
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

                if (headerName === 'Data/Hora' || headerName === 'Timestamp') { // Ajuste para o nome real da sua coluna de data/hora
                    try {
                        const date = new Date(cell);
                        tableHtml += `<td data-label="${headerName}">${date.toLocaleString('pt-BR')}</td>`;
                    } catch (e) {
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