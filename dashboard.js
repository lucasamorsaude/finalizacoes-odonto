document.addEventListener('DOMContentLoaded', () => {
    const resultadosDiv = document.getElementById('resultados');
    const dashboardMessageDiv = document.getElementById('dashboardMessage');
    const consultarButton = document.getElementById('consultarButton');
    const filtroProfissionalSelect = document.getElementById('filtroProfissional');
    const filtroUnidadeSelect = document.getElementById('filtroUnidade');
    const logoutButton = document.getElementById('logoutButton');
    const adminButton = document.getElementById('adminButton');

    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbxdmgw1jjZR153grD_A2SjjBLt1Z65E76pfxzfb7wHRO2P3yqNktjcP3USSvTM3cPGaLw/exec';

    const loggedInUser = localStorage.getItem('loggedInUser');

    let currentData = [];
    let currentHeaders = [];
    let sortDirectionDate = 'desc';
    let sortDirectionStatus = 'asc';

    if (localStorage.getItem('loggedIn') !== 'true' || !loggedInUser) {
        window.location.href = 'login.html';
        return;
    }

    // Exibe botão Admin apenas para o usuário admin
    if (loggedInUser === 'admin') {
        adminButton.style.display = 'inline-block';
    }

    adminButton.addEventListener('click', () => {
        window.location.href = 'admin.html';
    });

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
            }
        } catch (error) {
            console.error('Erro de conexão ao carregar profissionais:', error);
        }
    }

    async function fetchData() {
        resultadosDiv.innerHTML = '<p>Carregando dados...</p>';
        dashboardMessageDiv.textContent = '';

        const profissionalSelecionado = filtroProfissionalSelect.value;
        const unidadeSelecionada = filtroUnidadeSelect.value;
        const queryParams = new URLSearchParams();

        queryParams.append('action', 'getData');
        queryParams.append('usernameLogado', loggedInUser);

        if (profissionalSelecionado && profissionalSelecionado !== 'Todos') {
            queryParams.append('profissional', profissionalSelecionado);
        }
        if (unidadeSelecionada && unidadeSelecionada !== 'Todos') {
            queryParams.append('unidade', unidadeSelecionada);
        }

        try {
            const response = await fetch(`${WEB_APP_URL}?${queryParams.toString()}`);
            const data = await response.json();

            if (data.status === 'success' && data.data) {
                currentData = data.data;
                currentHeaders = data.headers;
                renderTable(currentHeaders, currentData);
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
            } else {
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

        document.querySelectorAll('.data-table th[data-sort-type]').forEach(headerCell => {
            headerCell.addEventListener('click', () => {
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
            return sortDirectionDate === 'asc'
                ? dateA.getTime() - dateB.getTime()
                : dateB.getTime() - dateA.getTime();
        });
        sortDirectionDate = sortDirectionDate === 'asc' ? 'desc' : 'asc';
        renderTable(currentHeaders, currentData);
    }

    function sortDataByStatus(columnIndex) {
        currentData.sort((a, b) => {
            const statusA = a[columnIndex].toString().toLowerCase();
            const statusB = b[columnIndex].toString().toLowerCase();
            return sortDirectionStatus === 'asc'
                ? statusA.localeCompare(statusB)
                : statusB.localeCompare(statusA);
        });
        sortDirectionStatus = sortDirectionStatus === 'asc' ? 'desc' : 'asc';
        renderTable(currentHeaders, currentData);
    }

    loadProfissionais();
    consultarButton.addEventListener('click', fetchData);
    logoutButton.addEventListener('click', () => {
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('loggedInUser');
        window.location.href = 'login.html';
    });
});
