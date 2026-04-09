const SPREADSHEET_ID = '1mZlf5Ah2fk9Bf6HIFwbuOwhCS7BOjmf32RWMJKKDj9w';
const SHEET_NAME = 'Finalizações';
const USERS_SHEET_NAME = 'Usuarios';

// Helper: verifica se o username é admin
function isAdmin(username) {
    const usersSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET_NAME);
    const usersData = usersSheet.getDataRange().getValues();
    const userCol = usersData[0].indexOf('Usuário');
    const profCol = usersData[0].indexOf('Profissional');
    for (let i = 1; i < usersData.length; i++) {
        if (usersData[i][userCol] === username) {
            return usersData[i][profCol] === 'admin';
        }
    }
    return false;
}

function doGet(e) {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const action = e.parameter.action;

    // Lista de profissionais ativos para o formulário de registro
    if (action === 'getProfissionais') {
        const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
        const usersData = usersSheet.getDataRange().getValues();
        const profCol = usersData[0].indexOf('Profissional');
        const ativoCol = usersData[0].indexOf('Ativo');

        if (profCol === -1) {
            return json({ status: 'error', message: 'Coluna "Profissional" não encontrada.' });
        }

        const profissionais = [...new Set(
            usersData.slice(1)
                .filter(row => ativoCol === -1 || row[ativoCol] === true || String(row[ativoCol]).toUpperCase() === 'TRUE')
                .map(row => row[profCol])
        )].filter(p => p && p !== 'admin');

        return json({ status: 'success', profissionais });
    }

    // Lista de profissionais já registrados (para filtro do dashboard)
    if (action === 'getProfissionaisFilter') {
        const sheet = ss.getSheetByName(SHEET_NAME);
        const data = sheet.getDataRange().getValues();
        const profCol = data[0].indexOf('Profissional');

        if (profCol === -1) {
            return json({ status: 'error', message: 'Coluna "Profissional" não encontrada.' });
        }

        const profissionais = [...new Set(data.slice(1).map(row => row[profCol]))].filter(p => p);
        return json({ status: 'success', profissionais });
    }

    // Dados das finalizações com filtros de segurança
    if (action === 'getData') {
        const usernameLogado = e.parameter.usernameLogado;
        const profissionalFiltro = e.parameter.profissional;
        const unidadeFiltro = e.parameter.unidade;

        const sheet = ss.getSheetByName(SHEET_NAME);
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        let rows = data.slice(1);

        const profCol = headers.indexOf('Profissional');
        const unidadeCol = headers.indexOf('Unidade');

        // Busca nome completo do profissional logado
        const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
        const usersData = usersSheet.getDataRange().getValues();
        const userCol = usersData[0].indexOf('Usuário');
        const profColUsers = usersData[0].indexOf('Profissional');

        let nomeProfLogado = null;
        for (let i = 1; i < usersData.length; i++) {
            if (usersData[i][userCol] === usernameLogado) {
                nomeProfLogado = usersData[i][profColUsers];
                break;
            }
        }

        if (!nomeProfLogado) {
            return json({ status: 'error', message: 'Usuário não encontrado.' });
        }

        // Filtro de segurança: não-admin só vê os próprios registros
        if (nomeProfLogado !== 'admin' && profCol !== -1) {
            rows = rows.filter(row => row[profCol] === nomeProfLogado);
        }

        // Filtro dropdown profissional
        if (profissionalFiltro && profissionalFiltro !== 'Todos' && profCol !== -1) {
            rows = rows.filter(row => row[profCol] === profissionalFiltro);
        }

        // Filtro unidade
        if (unidadeFiltro && unidadeFiltro !== 'Todos' && unidadeCol !== -1) {
            rows = rows.filter(row => row[unidadeCol] === unidadeFiltro);
        }

        return json({ status: 'success', headers, data: rows });
    }

    // Admin: lista de usuários
    if (action === 'getUsuarios') {
        if (!isAdmin(e.parameter.usernameLogado)) {
            return json({ status: 'error', message: 'Acesso negado.' });
        }

        const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
        const usersData = usersSheet.getDataRange().getValues();
        return json({ status: 'success', headers: usersData[0], data: usersData.slice(1) });
    }

    return json({ status: 'error', message: 'Ação GET inválida.' });
}


function doPost(e) {
    const action = e.parameter.action;

    if (action === 'login') {
        return handleLogin(e);
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);

    // Admin: criar usuário
    if (action === 'createUsuario') {
        if (!isAdmin(e.parameter.usernameLogado)) {
            return json({ status: 'error', message: 'Acesso negado.' });
        }
        const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
        usersSheet.appendRow([
            e.parameter.usuario,
            e.parameter.senha,
            e.parameter.profissional,
            true,
            e.parameter.unidade || ''
        ]);
        return json({ status: 'success', message: 'Usuário criado com sucesso.' });
    }

    // Admin: editar usuário
    if (action === 'updateUsuario') {
        if (!isAdmin(e.parameter.usernameLogado)) {
            return json({ status: 'error', message: 'Acesso negado.' });
        }
        const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
        const usersData = usersSheet.getDataRange().getValues();
        const userCol = usersData[0].indexOf('Usuário');
        const senhaCol = usersData[0].indexOf('Senha');
        const profCol = usersData[0].indexOf('Profissional');
        const unidadeCol = usersData[0].indexOf('Unidade');
        const targetUser = e.parameter.targetUsuario;

        for (let i = 1; i < usersData.length; i++) {
            if (usersData[i][userCol] === targetUser) {
                const rowNum = i + 1;
                if (e.parameter.senha) usersSheet.getRange(rowNum, senhaCol + 1).setValue(e.parameter.senha);
                if (e.parameter.profissional) usersSheet.getRange(rowNum, profCol + 1).setValue(e.parameter.profissional);
                if (unidadeCol !== -1 && e.parameter.unidade !== undefined) {
                    usersSheet.getRange(rowNum, unidadeCol + 1).setValue(e.parameter.unidade);
                }
                return json({ status: 'success', message: 'Usuário atualizado.' });
            }
        }
        return json({ status: 'error', message: 'Usuário não encontrado.' });
    }

    // Admin: ativar/inativar usuário
    if (action === 'toggleUsuario') {
        if (!isAdmin(e.parameter.usernameLogado)) {
            return json({ status: 'error', message: 'Acesso negado.' });
        }
        const usersSheet = ss.getSheetByName(USERS_SHEET_NAME);
        const usersData = usersSheet.getDataRange().getValues();
        const userCol = usersData[0].indexOf('Usuário');
        const ativoCol = usersData[0].indexOf('Ativo');
        const targetUser = e.parameter.targetUsuario;

        if (ativoCol === -1) {
            return json({ status: 'error', message: 'Coluna "Ativo" não encontrada na planilha.' });
        }

        for (let i = 1; i < usersData.length; i++) {
            if (usersData[i][userCol] === targetUser) {
                const current = usersData[i][ativoCol] === true || String(usersData[i][ativoCol]).toUpperCase() === 'TRUE';
                const newValue = !current;
                usersSheet.getRange(i + 1, ativoCol + 1).setValue(newValue);
                return json({ status: 'success', ativo: newValue });
            }
        }
        return json({ status: 'error', message: 'Usuário não encontrado.' });
    }

    // Registro de finalização
    const sheet = ss.getSheetByName(SHEET_NAME);
    const unidade = e.parameter.unidade;
    const paciente = e.parameter.paciente;
    const procedimento = e.parameter.procedimento;
    const profissional = e.parameter.profissional;
    const timestamp = new Date();

    if (unidade && paciente && procedimento && profissional) {
        sheet.appendRow([unidade, paciente, procedimento, profissional, timestamp, 'Pendente']);
        return json({ status: 'success', message: 'Dados registrados com sucesso!' });
    }

    return json({ status: 'error', message: "Parâmetros 'unidade', 'paciente', 'procedimento' ou 'profissional' ausentes." });
}


function handleLogin(e) {
    const username = e.parameter.username;
    const password = e.parameter.password;

    const usersSheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(USERS_SHEET_NAME);
    const usersData = usersSheet.getDataRange().getValues();

    const userCol = usersData[0].indexOf('Usuário');
    const passCol = usersData[0].indexOf('Senha');
    const ativoCol = usersData[0].indexOf('Ativo');

    if (userCol === -1 || passCol === -1) {
        return json({ status: 'error', message: 'Colunas "Usuário" ou "Senha" não encontradas.' });
    }

    for (let i = 1; i < usersData.length; i++) {
        if (usersData[i][userCol] === username && String(usersData[i][passCol]) === password) {
            if (ativoCol !== -1) {
                const ativo = usersData[i][ativoCol];
                if (ativo !== true && String(ativo).toUpperCase() !== 'TRUE') {
                    return json({ status: 'error', message: 'Usuário inativo. Contate o administrador.' });
                }
            }
            return json({ status: 'success', message: 'Login bem-sucedido!', username });
        }
    }

    return json({ status: 'error', message: 'Usuário ou senha inválidos.' });
}


// Utilitário para retornar JSON
function json(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
