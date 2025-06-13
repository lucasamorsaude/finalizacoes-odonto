document.addEventListener('DOMContentLoaded', () => {
    const resultadosDiv = document.getElementById('resultados');
    const dashboardMessageDiv = document.getElementById('dashboardMessage');
    const consultarButton = document.getElementById('consultarButton');
    const filtroProfissionalSelect = document.getElementById('filtroProfissional');
    const logoutButton = document.getElementById('logoutButton');

    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzI_AnXFV0LQzWsWqg9i7B1s0gR6oqBOIbpGYbrBOxNJIPOvFOvneUfwnKX2xP8ITLLhQ/exec';

    const loggedInUser = localStorage.getItem('loggedInUser');

    let currentData = []; // Armazenar os dados atuais para ordenação
    let sortDirectionDate = 'desc'; // 'asc' ou 'desc'
    let sortDirectionStatus = 'asc'; // 'asc' ou 'desc'

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
                currentData = data.data; // Armazena os dados brutos
                renderTable(data.headers, currentData); // Renderiza a tabela inicial
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
        headers.forEach((header, index) => {
            if (header === 'DATA E HORA DE INCLUSÃO' || header === 'Timestamp' || header.includes('Data')) {
                tableHtml += `<th data-column-index="${index}" data-sort-type="date">
                                ${header} 
                                <i class="fas ${sortDirectionDate === 'asc' ? 'fa-sort-up' : 'fa-sort-down'}" data-sort-by="date"></i>
                              </th>`;
            } else if (header === 'STATUS') {
                tableHtml += `<th data-column-index="${index}" data-sort-type="status">
                                ${header} 
                                <i class="fas ${sortDirectionStatus === 'asc' ? 'fa-sort-alpha-up' : 'fa-sort-alpha-down'}" data-sort-by="status"></i>
                              </th>`;
            }
            else {
                tableHtml += `<th>${header}</th>`;
            }
        });
        tableHtml += '</tr></thead><tbody>';

        rows.forEach(row => {
            tableHtml += '<tr>';
            row.forEach((cell, index) => {
                const headerName = headers[index];

                if (headerName === 'DATA E HORA DE INCLUSÃO' || headerName === 'Timestamp' || headerName.includes('Data')) {
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

        // Adiciona event listeners para os cabeçalhos de ordenação
        document.querySelectorAll('.data-table th[data-sort-type]').forEach(headerCell => {
            headerCell.addEventListener('click', (event) => {
                const sortType = headerCell.dataset.sortType;
                const columnIndex = parseInt(headerCell.dataset.columnIndex);
                
                if (sortType === 'date') {
                    sortDataByDate(columnIndex);
                } else if (sortType === 'status') {
                    sortDataByStatus(columnIndex);
                }
            });
        });
    }

    function sortDataByDate(columnIndex) {
        currentData.sort((a, b) => {
            const dateA = new Date(a[columnIndex]);
            const dateB = new Date(b[columnIndex]);
            if (sortDirectionDate === 'asc') {
                return dateA.getTime() - dateB.getTime();
            } else {
                return dateB.getTime() - dateA.getTime();
            }
        });
        sortDirectionDate = sortDirectionDate === 'asc' ? 'desc' : 'asc';
        renderTable(getHeadersFromCurrentTable(), currentData); // Re-renderiza para atualizar ícone
    }

    function sortDataByStatus(columnIndex) {
        currentData.sort((a, b) => {
            const statusA = a[columnIndex].toString().toLowerCase();
            const statusB = b[columnIndex].toString().toLowerCase();
            if (sortDirectionStatus === 'asc') {
                return statusA.localeCompare(statusB);
            } else {
                return statusB.localeCompare(statusA);
            }
        });
        sortDirectionStatus = sortDirectionStatus === 'asc' ? 'desc' : 'asc';
        renderTable(getHeadersFromCurrentTable(), currentData); // Re-renderiza para atualizar ícone
    }

    // Função para obter os headers da tabela já renderizada (necessário para re-renderizar)
    function getHeadersFromCurrentTable() {
        const headerElements = document.querySelectorAll('.data-table th');
        return Array.from(headerElements).map(th => {
            // Remove o texto do ícone para obter apenas o nome do cabeçalho
            const text = th.textContent.trim();
            // Remove o último espaço em branco se houver (para remover o texto do ícone)
            return text.replace(/\s*[\u2190-\u21FF\u25BA\u25BC\uF000-\uF0FF]+$/, '').trim(); // Remove setas ou ícones do Font Awesome
        });
    }

    loadProfissionais();
    consultarButton.addEventListener('click', fetchData);
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('loggedInUser');
        window.location.href = 'login.html';
    });
});