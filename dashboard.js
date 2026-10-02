document.addEventListener('DOMContentLoaded', async () => {
    const perfil = await carregarPerfil();
    if (!perfil) {
        window.location.href = 'login.html';
        return;
    }
    const isAdmin = perfil.is_admin;

    const filtrosForm = document.getElementById('filtrosForm');
    const filtroUnidade = document.getElementById('filtroUnidade');
    const filtroProfissional = document.getElementById('filtroProfissional');
    const filtroStatus = document.getElementById('filtroStatus');
    const filtroPaciente = document.getElementById('filtroPaciente');
    const filtroDe = document.getElementById('filtroDe');
    const filtroAte = document.getElementById('filtroAte');
    const resultadosDiv = document.getElementById('resultados');
    const resumoDiv = document.getElementById('resumoStatus');
    const contagemSpan = document.getElementById('contagem');
    const carregarMaisButton = document.getElementById('carregarMaisButton');
    const exportarButton = document.getElementById('exportarButton');
    const dashboardMessageDiv = document.getElementById('dashboardMessage');

    const POR_PAGINA = 100;
    const COLUNAS = 'id, unidade, paciente, procedimento, profissional, status, observacao, created_at';
    const CLASSE_STATUS = {
        'Pendente': 'pendente',
        'Aguardando liberação': 'aguardando',
        'Aguardando pagamento': 'pagamento',
        'Finalizado': 'finalizado',
    };

    let linhas = [];
    let total = 0;
    let ordem = { coluna: 'created_at', asc: false };

    // ── Setup ──────────────────────────────────────────────────────────────

    STATUS_OPCOES.forEach(status => filtroStatus.add(new Option(status, status)));

    if (isAdmin) {
        document.getElementById('adminButton').style.display = 'inline-flex';
        document.getElementById('grupoProfissional').style.display = '';
        exportarButton.style.display = 'inline-flex';
        loadProfissionais();
    }

    document.getElementById('adminButton').addEventListener('click', () => {
        window.location.href = 'admin.html';
    });
    document.getElementById('logoutButton').addEventListener('click', sair);

    filtrosForm.addEventListener('submit', (event) => {
        event.preventDefault();
        consultar();
    });
    carregarMaisButton.addEventListener('click', () => consultar({ acrescentar: true }));
    exportarButton.addEventListener('click', exportarCsv);

    async function loadProfissionais() {
        const { data, error } = await sb.rpc('profissionais_registrados');
        if (error) {
            console.error('Erro ao carregar profissionais:', error);
            return;
        }
        data.forEach(prof => filtroProfissional.add(new Option(prof, prof)));
    }

    // ── Consulta ───────────────────────────────────────────────────────────

    // Datas do filtro são dias no horário de Brasília; "Até" inclui o dia inteiro
    function filtrosAtuais() {
        const ate = filtroAte.value
            ? new Date(new Date(`${filtroAte.value}T00:00:00-03:00`).getTime() + 86400000).toISOString()
            : null;
        return {
            unidade: filtroUnidade.value || null,
            profissional: isAdmin ? (filtroProfissional.value || null) : null,
            status: filtroStatus.value || null,
            paciente: filtroPaciente.value.trim() || null,
            de: filtroDe.value ? new Date(`${filtroDe.value}T00:00:00-03:00`).toISOString() : null,
            ate,
        };
    }

    function montarQuery(f) {
        let query = sb.from('finalizacoes').select(COLUNAS, { count: 'exact' });
        if (f.unidade) query = query.eq('unidade', f.unidade);
        if (f.profissional) query = query.eq('profissional', f.profissional);
        if (f.status) query = query.eq('status', f.status);
        if (f.paciente) query = query.ilike('paciente', `%${f.paciente}%`);
        if (f.de) query = query.gte('created_at', f.de);
        if (f.ate) query = query.lt('created_at', f.ate);
        return query
            .order(ordem.coluna, { ascending: ordem.asc })
            .order('id', { ascending: ordem.asc });
    }

    async function consultar({ acrescentar = false } = {}) {
        const f = filtrosAtuais();
        const inicio = acrescentar ? linhas.length : 0;

        dashboardMessageDiv.textContent = '';
        resultadosDiv.classList.add('carregando');
        carregarMaisButton.disabled = true;

        const [lista, resumo] = await Promise.all([
            montarQuery(f).range(inicio, inicio + POR_PAGINA - 1),
            acrescentar ? null : sb.rpc('resumo_status', {
                p_unidade: f.unidade,
                p_profissional: f.profissional,
                p_paciente: f.paciente,
                p_de: f.de,
                p_ate: f.ate,
            }),
        ]);

        resultadosDiv.classList.remove('carregando');
        carregarMaisButton.disabled = false;

        if (lista.error) {
            console.error('Erro na consulta:', lista.error);
            mostrarMensagem('Erro ao consultar dados. Tente novamente.', 'erro');
            return;
        }

        linhas = acrescentar ? linhas.concat(lista.data) : lista.data;
        total = lista.count ?? linhas.length;
        renderTable();
        if (resumo) renderResumo(resumo.data || [], f.status);
    }

    // ── Renderização ───────────────────────────────────────────────────────

    function renderResumo(contagens, statusAtivo) {
        const porStatus = Object.fromEntries(contagens.map(c => [c.status, c.total]));
        const totalGeral = contagens.reduce((soma, c) => soma + Number(c.total), 0);

        resumoDiv.innerHTML = [['', 'Todos', totalGeral], ...STATUS_OPCOES.map(s => [s, s, porStatus[s] || 0])]
            .map(([valor, rotulo, qtd]) => `
                <button type="button" class="chip ${valor ? 'chip--' + CLASSE_STATUS[valor] : ''} ${valor === (statusAtivo || '') ? 'chip--ativo' : ''}"
                    data-status="${escapeHtml(valor)}">
                    ${escapeHtml(rotulo)} <strong>${Number(qtd).toLocaleString('pt-BR')}</strong>
                </button>`)
            .join('');
    }

    resumoDiv.addEventListener('click', (event) => {
        const chip = event.target.closest('.chip');
        if (!chip) return;
        filtroStatus.value = chip.dataset.status;
        consultar();
    });

    function iconeOrdem(coluna) {
        if (ordem.coluna !== coluna) return 'fa-sort';
        return ordem.asc ? 'fa-sort-up' : 'fa-sort-down';
    }

    function renderTable() {
        contagemSpan.textContent = total
            ? `Exibindo ${linhas.length.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}`
            : '';
        carregarMaisButton.style.display = linhas.length < total ? 'inline-flex' : 'none';

        if (linhas.length === 0) {
            resultadosDiv.innerHTML = '<p>Nenhum resultado encontrado para o filtro aplicado.</p>';
            return;
        }

        let html = `<table class="data-table"><thead><tr>
            <th data-ordenar="created_at">Data <i class="fas ${iconeOrdem('created_at')}"></i></th>
            <th>Unidade</th>
            <th>Paciente</th>
            <th>Procedimento</th>
            ${isAdmin ? '<th>Profissional</th>' : ''}
            <th data-ordenar="status">Status <i class="fas ${iconeOrdem('status')}"></i></th>
            <th>Observação</th>
        </tr></thead><tbody>`;

        linhas.forEach(linha => {
            const statusHtml = isAdmin
                ? `<select class="status-select status--${CLASSE_STATUS[linha.status]}" data-id="${linha.id}">
                       ${STATUS_OPCOES.map(s => `<option ${s === linha.status ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
                   </select>`
                : `<span class="status-badge status--${CLASSE_STATUS[linha.status]}">${escapeHtml(linha.status)}</span>`;

            const obsHtml = isAdmin
                ? `<input type="text" class="obs-input" data-id="${linha.id}" value="${escapeHtml(linha.observacao)}" placeholder="—">`
                : escapeHtml(linha.observacao || '—');

            html += `<tr>
                <td data-label="Data">${new Date(linha.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                <td data-label="Unidade">${escapeHtml(linha.unidade)}</td>
                <td data-label="Paciente">${escapeHtml(linha.paciente)}</td>
                <td data-label="Procedimento" class="col-texto">${escapeHtml(linha.procedimento)}</td>
                ${isAdmin ? `<td data-label="Profissional">${escapeHtml(linha.profissional)}</td>` : ''}
                <td data-label="Status">${statusHtml}</td>
                <td data-label="Observação" class="col-texto">${obsHtml}</td>
            </tr>`;
        });

        resultadosDiv.innerHTML = html + '</tbody></table>';
    }

    resultadosDiv.addEventListener('click', (event) => {
        const th = event.target.closest('th[data-ordenar]');
        if (!th) return;
        const coluna = th.dataset.ordenar;
        ordem = { coluna, asc: ordem.coluna === coluna ? !ordem.asc : coluna === 'status' };
        consultar();
    });

    // ── Edição inline (admin) ──────────────────────────────────────────────

    resultadosDiv.addEventListener('change', async (event) => {
        const el = event.target;
        if (!el.matches('.status-select, .obs-input')) return;

        const id = Number(el.dataset.id);
        const linha = linhas.find(l => l.id === id);
        const campo = el.matches('.status-select') ? 'status' : 'observacao';
        const valor = campo === 'status' ? el.value : (el.value.trim() || null);

        el.disabled = true;
        const { data, error } = await sb.from('finalizacoes').update({ [campo]: valor }).eq('id', id).select('id');
        el.disabled = false;

        if (error || !data.length) {
            console.error('Erro ao salvar:', error);
            mostrarMensagem('Não foi possível salvar a alteração.', 'erro');
            el.value = linha[campo] ?? '';
            return;
        }

        linha[campo] = valor;
        if (campo === 'status') {
            el.className = `status-select status--${CLASSE_STATUS[valor]}`;
            atualizarResumo();
        }
        el.classList.add('salvo');
        setTimeout(() => el.classList.remove('salvo'), 1200);
    });

    async function atualizarResumo() {
        const f = filtrosAtuais();
        const { data } = await sb.rpc('resumo_status', {
            p_unidade: f.unidade,
            p_profissional: f.profissional,
            p_paciente: f.paciente,
            p_de: f.de,
            p_ate: f.ate,
        });
        if (data) renderResumo(data, f.status);
    }

    // ── Exportação (admin) ─────────────────────────────────────────────────

    async function exportarCsv() {
        exportarButton.disabled = true;
        const f = filtrosAtuais();
        const todas = [];

        // PostgREST devolve no máximo 1000 linhas por requisição
        for (let inicio = 0; ; inicio += 1000) {
            const { data, error } = await montarQuery(f).range(inicio, inicio + 999);
            if (error) {
                mostrarMensagem('Erro ao exportar.', 'erro');
                exportarButton.disabled = false;
                return;
            }
            todas.push(...data);
            if (data.length < 1000) break;
        }

        const celula = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const csv = [
            ['Data', 'Unidade', 'Paciente', 'Procedimento', 'Profissional', 'Status', 'Observação'],
            ...todas.map(l => [
                new Date(l.created_at).toLocaleString('pt-BR'),
                l.unidade, l.paciente, l.procedimento, l.profissional, l.status, l.observacao,
            ]),
        ].map(linha => linha.map(celula).join(';')).join('\r\n');

        // BOM + ";" para o Excel em português abrir com acentos e colunas certas
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `finalizacoes-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
        exportarButton.disabled = false;
    }

    function mostrarMensagem(msg, tipo) {
        dashboardMessageDiv.textContent = msg;
        dashboardMessageDiv.style.color = tipo === 'erro' ? '#dc3545' : '#28a745';
        setTimeout(() => { dashboardMessageDiv.textContent = ''; }, 5000);
    }

    consultar();
});
