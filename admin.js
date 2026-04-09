document.addEventListener('DOMContentLoaded', () => {
    const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbzZ4pDx74e82rT2TJQevF-DB-cKGIuzPvTQASLqytmA0AyRivmjgvuprlAOI3ye2zpySQ/exec';

    const loggedInUser = localStorage.getItem('loggedInUser');

    // Redireciona se não for admin
    if (localStorage.getItem('loggedIn') !== 'true' || localStorage.getItem('isAdmin') !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    const tabelaDiv = document.getElementById('tabelaUsuarios');
    const adminMessage = document.getElementById('adminMessage');
    const modalOverlay = document.getElementById('modalOverlay');
    const usuarioForm = document.getElementById('usuarioForm');
    const modalTitulo = document.getElementById('modalTitulo');

    // Campos do modal
    const inputUsuario = document.getElementById('inputUsuario');
    const inputSenha = document.getElementById('inputSenha');
    const inputProfissional = document.getElementById('inputProfissional');
    const inputUnidade = document.getElementById('inputUnidade');
    const targetUsuarioInput = document.getElementById('targetUsuario');

    let modoEdicao = false;

    // Navegação
    document.getElementById('voltarButton').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });
    document.getElementById('logoutButton').addEventListener('click', () => {
        localStorage.removeItem('loggedIn');
        localStorage.removeItem('loggedInUser');
        localStorage.removeItem('isAdmin');
        window.location.href = 'login.html';
    });

    // Modal: abrir para novo usuário
    document.getElementById('novoUsuarioButton').addEventListener('click', () => {
        modoEdicao = false;
        modalTitulo.textContent = 'Novo Usuário';
        usuarioForm.reset();
        inputUsuario.disabled = false;
        targetUsuarioInput.value = '';
        document.getElementById('inputSenha').placeholder = 'Defina a senha';
        abrirModal();
    });

    // Modal: cancelar
    document.getElementById('modalCancelarBtn').addEventListener('click', fecharModal);
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) fecharModal();
    });

    // Modal: salvar
    usuarioForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('modalSalvarBtn');
        btn.disabled = true;
        btn.textContent = 'Salvando...';

        const formData = new FormData();
        formData.append('usernameLogado', loggedInUser);
        formData.append('profissional', inputProfissional.value.trim());
        formData.append('unidade', inputUnidade.value);
        if (inputSenha.value) formData.append('senha', inputSenha.value);

        if (modoEdicao) {
            formData.append('action', 'updateUsuario');
            formData.append('targetUsuario', targetUsuarioInput.value);
        } else {
            formData.append('action', 'createUsuario');
            formData.append('usuario', inputUsuario.value.trim());
            if (!inputSenha.value) {
                showMessage('Informe uma senha para o novo usuário.', 'error');
                btn.disabled = false;
                btn.textContent = 'Salvar';
                return;
            }
        }

        try {
            const response = await fetch(WEB_APP_URL, { method: 'POST', body: formData });
            const data = await response.json();
            if (data.status === 'success') {
                showMessage(data.message, 'success');
                fecharModal();
                loadUsuarios();
            } else {
                showMessage(data.message, 'error');
            }
        } catch (err) {
            showMessage('Erro de conexão.', 'error');
        }

        btn.disabled = false;
        btn.textContent = 'Salvar';
    });

    // Carrega tabela de usuários
    async function loadUsuarios() {
        tabelaDiv.innerHTML = '<p>Carregando...</p>';
        try {
            const response = await fetch(`${WEB_APP_URL}?action=getUsuarios&usernameLogado=${loggedInUser}`);
            const data = await response.json();

            if (data.status !== 'success') {
                tabelaDiv.innerHTML = `<p>${data.message}</p>`;
                return;
            }

            const headers = data.headers;
            const rows = data.data;

            const userCol = headers.indexOf('Usuário');
            const profCol = headers.indexOf('Profissional');
            const unidadeCol = headers.indexOf('Unidade');
            const ativoCol = headers.indexOf('Ativo');
            const senhaCol = headers.indexOf('Senha');

            if (rows.length === 0) {
                tabelaDiv.innerHTML = '<p>Nenhum usuário cadastrado.</p>';
                return;
            }

            let html = `<table class="data-table admin-table">
                <thead>
                    <tr>
                        <th>Usuário</th>
                        <th>Profissional</th>
                        <th>Unidade</th>
                        <th>Status</th>
                        <th>Ações</th>
                    </tr>
                </thead>
                <tbody>`;

            rows.forEach(row => {
                const usuario = userCol !== -1 ? row[userCol] : '—';
                const profissional = profCol !== -1 ? row[profCol] : '—';
                const unidade = unidadeCol !== -1 ? row[unidadeCol] : '—';
                const ativo = ativoCol !== -1
                    ? (row[ativoCol] === true || String(row[ativoCol]).toUpperCase() === 'TRUE')
                    : true;
                const senha = senhaCol !== -1 ? row[senhaCol] : '';

                const statusBadge = ativo
                    ? '<span class="badge badge--ativo">Ativo</span>'
                    : '<span class="badge badge--inativo">Inativo</span>';

                const toggleLabel = ativo ? 'Inativar' : 'Ativar';
                const toggleClass = ativo ? 'btn-admin btn-admin--danger' : 'btn-admin btn-admin--success';

                html += `<tr>
                    <td data-label="Usuário">${usuario}</td>
                    <td data-label="Profissional">${profissional}</td>
                    <td data-label="Unidade">${unidade || '—'}</td>
                    <td data-label="Status">${statusBadge}</td>
                    <td data-label="Ações" class="acoes-cell">
                        <button class="btn-admin btn-admin--secondary btn-editar"
                            data-usuario="${usuario}"
                            data-profissional="${profissional}"
                            data-unidade="${unidade}"
                            data-senha="${senha}">
                            <i class="fas fa-pen"></i> Editar
                        </button>
                        <button class="${toggleClass} btn-toggle"
                            data-usuario="${usuario}"
                            data-ativo="${ativo}">
                            ${toggleLabel}
                        </button>
                    </td>
                </tr>`;
            });

            html += '</tbody></table>';
            tabelaDiv.innerHTML = html;

            // Listeners: editar
            document.querySelectorAll('.btn-editar').forEach(btn => {
                btn.addEventListener('click', () => {
                    modoEdicao = true;
                    modalTitulo.textContent = 'Editar Usuário';
                    inputUsuario.value = btn.dataset.usuario;
                    inputUsuario.disabled = true;
                    inputProfissional.value = btn.dataset.profissional;
                    inputUnidade.value = btn.dataset.unidade || '';
                    inputSenha.value = '';
                    inputSenha.placeholder = 'Deixe em branco para não alterar';
                    targetUsuarioInput.value = btn.dataset.usuario;
                    abrirModal();
                });
            });

            // Listeners: toggle ativo
            document.querySelectorAll('.btn-toggle').forEach(btn => {
                btn.addEventListener('click', async () => {
                    btn.disabled = true;
                    const formData = new FormData();
                    formData.append('action', 'toggleUsuario');
                    formData.append('usernameLogado', loggedInUser);
                    formData.append('targetUsuario', btn.dataset.usuario);

                    try {
                        const response = await fetch(WEB_APP_URL, { method: 'POST', body: formData });
                        const data = await response.json();
                        if (data.status === 'success') {
                            showMessage(`Usuário ${btn.dataset.usuario} ${data.ativo ? 'ativado' : 'inativado'}.`, 'success');
                            loadUsuarios();
                        } else {
                            showMessage(data.message, 'error');
                            btn.disabled = false;
                        }
                    } catch (err) {
                        showMessage('Erro de conexão.', 'error');
                        btn.disabled = false;
                    }
                });
            });

        } catch (err) {
            tabelaDiv.innerHTML = '<p>Erro de conexão ao carregar usuários.</p>';
        }
    }

    function abrirModal() {
        modalOverlay.style.display = 'flex';
    }

    function fecharModal() {
        modalOverlay.style.display = 'none';
        usuarioForm.reset();
    }

    function showMessage(msg, type) {
        adminMessage.textContent = msg;
        adminMessage.style.color = type === 'success' ? '#28a745' : '#dc3545';
        setTimeout(() => { adminMessage.textContent = ''; }, 4000);
    }

    loadUsuarios();
});
