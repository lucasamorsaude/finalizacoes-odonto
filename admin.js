document.addEventListener('DOMContentLoaded', async () => {
    const perfil = await carregarPerfil();
    if (!perfil || !perfil.is_admin) {
        window.location.href = 'login.html';
        return;
    }

    const tabelaDiv = document.getElementById('tabelaUsuarios');
    const adminMessage = document.getElementById('adminMessage');
    const modalOverlay = document.getElementById('modalOverlay');
    const usuarioForm = document.getElementById('usuarioForm');
    const modalTitulo = document.getElementById('modalTitulo');
    const salvarBtn = document.getElementById('modalSalvarBtn');

    // Campos do modal
    const inputUsuario = document.getElementById('inputUsuario');
    const inputSenha = document.getElementById('inputSenha');
    const inputProfissional = document.getElementById('inputProfissional');
    const inputUnidade = document.getElementById('inputUnidade');
    const inputAdmin = document.getElementById('inputAdmin');

    let usuarios = [];
    let emEdicao = null; // usuário sendo editado; null = criando novo

    // Navegação
    document.getElementById('voltarButton').addEventListener('click', () => {
        window.location.href = 'dashboard.html';
    });
    document.getElementById('logoutButton').addEventListener('click', sair);

    // Modal: abrir para novo usuário
    document.getElementById('novoUsuarioButton').addEventListener('click', () => {
        emEdicao = null;
        modalTitulo.textContent = 'Novo Usuário';
        usuarioForm.reset();
        inputUsuario.disabled = false;
        inputAdmin.disabled = false;
        inputSenha.placeholder = 'Defina a senha';
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
        salvarBtn.disabled = true;
        salvarBtn.textContent = 'Salvando...';

        const erro = emEdicao ? await salvarEdicao() : await criarUsuario();

        salvarBtn.disabled = false;
        salvarBtn.innerHTML = '<i class="fas fa-check"></i> Salvar';

        if (erro) {
            showMessage(erro, 'error');
            return;
        }
        fecharModal();
        loadUsuarios();
    });

    // Chama a Edge Function; retorna mensagem de erro ou null
    async function chamarFuncao(corpo) {
        const { data, error } = await sb.functions.invoke('admin-usuarios', { body: corpo });
        if (!error) return { mensagem: data.mensagem };

        const detalhe = await error.context?.json?.().catch(() => null);
        return { erro: detalhe?.erro || 'Erro de conexão.' };
    }

    async function criarUsuario() {
        if (!inputSenha.value) return 'Informe uma senha para o novo usuário.';

        const { erro, mensagem } = await chamarFuncao({
            acao: 'criar',
            username: inputUsuario.value,
            senha: inputSenha.value,
            profissional: inputProfissional.value.trim(),
            unidade: inputUnidade.value || null,
            is_admin: inputAdmin.checked,
        });
        if (erro) return erro;

        showMessage(mensagem, 'success');
        return null;
    }

    async function salvarEdicao() {
        const { error } = await sb.from('usuarios').update({
            profissional: inputProfissional.value.trim(),
            unidade: inputUnidade.value || null,
            is_admin: inputAdmin.checked,
        }).eq('id', emEdicao.id);
        if (error) return 'Erro ao salvar: ' + error.message;

        if (inputSenha.value) {
            const { erro } = await chamarFuncao({ acao: 'senha', id: emEdicao.id, senha: inputSenha.value });
            if (erro) return 'Dados salvos, mas a senha não foi alterada: ' + erro;
        }

        showMessage('Usuário atualizado.', 'success');
        return null;
    }

    // Carrega tabela de usuários
    async function loadUsuarios() {
        const { data, error } = await sb.from('usuarios')
            .select('id, username, profissional, unidade, ativo, is_admin')
            .order('ativo', { ascending: false })
            .order('profissional');

        if (error) {
            tabelaDiv.innerHTML = '<p>Erro de conexão ao carregar usuários.</p>';
            return;
        }

        usuarios = data;
        if (usuarios.length === 0) {
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

        usuarios.forEach(u => {
            const statusBadge = u.ativo
                ? '<span class="badge badge--ativo">Ativo</span>'
                : '<span class="badge badge--inativo">Inativo</span>';
            const adminBadge = u.is_admin ? ' <span class="badge badge--admin">Admin</span>' : '';
            const ehVoce = u.id === perfil.id;

            html += `<tr>
                <td data-label="Usuário">${escapeHtml(u.username)}</td>
                <td data-label="Profissional">${escapeHtml(u.profissional)}</td>
                <td data-label="Unidade">${escapeHtml(u.unidade || '—')}</td>
                <td data-label="Status">${statusBadge}${adminBadge}</td>
                <td data-label="Ações" class="acoes-cell">
                    <button class="btn-admin btn-admin--secondary btn-editar" data-id="${u.id}">
                        <i class="fas fa-pen"></i> Editar
                    </button>
                    ${ehVoce ? '' : `<button class="btn-admin ${u.ativo ? 'btn-admin--danger' : 'btn-admin--success'} btn-toggle" data-id="${u.id}">
                        ${u.ativo ? 'Inativar' : 'Ativar'}
                    </button>`}
                </td>
            </tr>`;
        });

        tabelaDiv.innerHTML = html + '</tbody></table>';
    }

    tabelaDiv.addEventListener('click', async (event) => {
        const btn = event.target.closest('button[data-id]');
        if (!btn) return;
        const u = usuarios.find(x => x.id === btn.dataset.id);

        if (btn.classList.contains('btn-editar')) {
            emEdicao = u;
            modalTitulo.textContent = 'Editar Usuário';
            inputUsuario.value = u.username;
            inputUsuario.disabled = true;
            inputProfissional.value = u.profissional;
            inputUnidade.value = u.unidade || '';
            inputAdmin.checked = u.is_admin;
            inputAdmin.disabled = u.id === perfil.id; // não remover o próprio acesso de admin
            inputSenha.value = '';
            inputSenha.placeholder = 'Deixe em branco para não alterar';
            abrirModal();
            return;
        }

        btn.disabled = true;
        const { error } = await sb.from('usuarios').update({ ativo: !u.ativo }).eq('id', u.id);
        if (error) {
            showMessage('Erro ao alterar status: ' + error.message, 'error');
            btn.disabled = false;
            return;
        }
        showMessage(`Usuário ${u.username} ${u.ativo ? 'inativado' : 'ativado'}.`, 'success');
        loadUsuarios();
    });

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
