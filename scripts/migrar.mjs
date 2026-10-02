// Migra usuários e finalizações da planilha (.xlsx exportado do Google Sheets) para o Supabase.
//
// Uso (dentro de scripts/), com DATABASE_URL e SUPABASE_SECRET_KEY no ../.env:
//   npm install
//   node migrar.mjs --dry-run                 # só mostra o que seria feito
//   node migrar.mjs                           # grava
//   node migrar.mjs "caminho/outra.xlsx"      # arquivo diferente do padrão
//
// Pode rodar de novo com uma cópia mais nova da planilha: só entram registros e usuários
// que ainda não estão no banco. Nada que já foi editado no sistema é sobrescrito.
// A chave secreta nunca deve ir para o repositório nem para o site.
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import ExcelJS from 'exceljs';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });

const DRY_RUN = process.argv.includes('--dry-run');
const ARQUIVO = process.argv.slice(2).find(a => !a.startsWith('--'))
    || fileURLToPath(new URL('../Finalizações Odonto.xlsx', import.meta.url));

// Precisam ser iguais aos de supabase-client.js
const DOMINIO_LOGIN = 'finalizacoes.local';
const PREFIXO_SENHA = 'odonto:';

// A planilha guarda horário de Brasília sem fuso; o Excel entrega como se fosse UTC
const OFFSET_BRASILIA_MS = 3 * 3600 * 1000;

const avisos = [];

// ── Normalização ─────────────────────────────────────────────────────────

function semAcento(texto) {
    return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function normalizarUsuario(usuario) {
    return semAcento(usuario).trim().toLowerCase().replace(/\s+/g, '.');
}

function normalizarUnidade(valor) {
    const u = String(valor ?? '').trim().toUpperCase();
    if (u === 'SJRD') return 'SJDR';
    return ['SJDR', 'SJDR APOIO'].includes(u) ? u : null;
}

// Status era texto livre na planilha: vira status padronizado + observação com o texto original
const FINALIZADO = /^f[a-z]*z[a-z]*d[a-z]*$/; // finalizado(s), finalizada, fializado, finalzado, finalizaod...
const INDICA_PENDENCIA = /\b(nao|pendente|precisa|falta|faltando|erro)\b|\?/;

function normalizarStatus(valor) {
    const original = String(valor ?? '').trim();
    const t = semAcento(original).toLowerCase();
    const palavras = t.split(/[^a-z]+/).filter(Boolean);

    let status = 'Pendente';
    if (FINALIZADO.test(palavras[0])) status = 'Finalizado';
    else if (t.startsWith('aguardando pagamento')) status = 'Aguardando pagamento';
    else if (t.startsWith('aguardando')) status = 'Aguardando liberação';
    else if (palavras.some(p => FINALIZADO.test(p)) && !INDICA_PENDENCIA.test(t)) status = 'Finalizado';

    const ehSoOStatus = !original || t === semAcento(status).toLowerCase() || FINALIZADO.test(t);
    return { status, observacao: ehSoOStatus ? null : original };
}

// Chave para não duplicar: mesmo paciente no mesmo instante
function chave(createdAt, paciente) {
    return `${new Date(createdAt).getTime()}|${semAcento(String(paciente)).trim().toLowerCase()}`;
}

// ── Leitura da planilha ──────────────────────────────────────────────────

function texto(celula) {
    if (celula == null) return '';
    if (typeof celula === 'object' && !(celula instanceof Date)) {
        if (celula.richText) return celula.richText.map(p => p.text).join('');
        if ('result' in celula) return texto(celula.result);
        if (celula.text) return String(celula.text);
    }
    return String(celula);
}

function dataDaCelula(celula) {
    if (celula instanceof Date) return new Date(celula.getTime() + OFFSET_BRASILIA_MS);
    if (typeof celula === 'number') return new Date((celula - 25569) * 86400000 + OFFSET_BRASILIA_MS); // serial do Excel
    return new Date(NaN);
}

// Lê uma aba como lista de objetos; `colunas` fixa os nomes quando a aba não tem cabeçalho
function lerAba(workbook, nome, colunas = null) {
    const aba = workbook.getWorksheet(nome);
    if (!aba) return [];

    const linhas = [];
    aba.eachRow({ includeEmpty: false }, (row, numero) => linhas.push({ numero, valores: row.values.slice(1) }));

    const cabecalho = colunas ?? linhas.shift().valores.map(v => texto(v).trim());
    return linhas
        .map(({ numero, valores }) => ({ numero, ...Object.fromEntries(cabecalho.map((c, i) => [c, valores[i]])) }))
        .filter(l => cabecalho.some(c => texto(l[c]).trim()));
}

function converterFinalizacoes(nomeAba, linhas, unidadePadrao = null) {
    let ultimaData = null;
    return linhas.map(l => {
        const onde = `${nomeAba} linha ${l.numero}`;
        let createdAt = dataDaCelula(l['Data e Hora de inclusão']);

        // Ano digitado errado (ex.: 20226): mantém dia/mês/hora e usa o ano do registro anterior
        if (createdAt.getUTCFullYear() > 2100 && ultimaData) {
            createdAt.setUTCFullYear(ultimaData.getUTCFullYear());
            avisos.push(`${onde}: ano inválido, data corrigida para ${createdAt.toISOString()}`);
        }
        if (isNaN(createdAt)) {
            avisos.push(`${onde}: sem data válida — usando a do registro anterior`);
            createdAt = new Date(ultimaData ?? Date.now());
        }
        ultimaData = createdAt;

        const unidadeOriginal = l['Unidade'] ?? unidadePadrao;
        const unidade = normalizarUnidade(texto(unidadeOriginal));
        if (!unidade) avisos.push(`${onde}: unidade "${texto(unidadeOriginal)}" inválida — registrada como SJDR`);

        return {
            unidade: unidade || 'SJDR',
            paciente: texto(l['Nome Paciente']).trim() || '(sem nome)',
            procedimento: texto(l['Procedimento']).trim() || '(não informado)',
            profissional: texto(l['Profissional']).trim(),
            ...normalizarStatus(texto(l['Status'])),
            created_at: createdAt.toISOString(),
        };
    });
}

console.log(`Lendo ${ARQUIVO}...`);
const workbook = new ExcelJS.Workbook();
await workbook.xlsx.readFile(ARQUIVO);

// Abas antigas primeiro: em registros repetidos entre abas, fica o da aba mais recente
const COLUNAS_JANFEVMAR = ['Unidade', 'Nome Paciente', 'Procedimento', 'Profissional', 'Data e Hora de inclusão', 'Status'];
const lidas = [
    ...converterFinalizacoes('Dezembro', lerAba(workbook, 'Dezembro'), 'SJDR'), // aba sem coluna Unidade
    ...converterFinalizacoes('JANFEVMAR', lerAba(workbook, 'JANFEVMAR', COLUNAS_JANFEVMAR)),
    ...converterFinalizacoes('Finalizações', lerAba(workbook, 'Finalizações')),
];
const porChave = new Map(lidas.map(f => [chave(f.created_at, f.paciente), f]));
const finalizacoes = [...porChave.values()];
const repetidasNaPlanilha = lidas.length - finalizacoes.length;

const todosUsuarios = lerAba(workbook, 'Usuarios')
    .filter(u => texto(u['Usuário']).trim())
    .map(u => {
        const isAdmin = texto(u['Profissional']).trim() === 'admin';
        const ativo = texto(u['Ativo']).trim().toUpperCase();
        return {
            original: texto(u['Usuário']).trim(),
            username: normalizarUsuario(texto(u['Usuário'])),
            senha: texto(u['Senha']),
            profissional: isAdmin ? 'Administração' : texto(u['Profissional']).trim(),
            unidade: normalizarUnidade(texto(u['Unidade'])),
            ativo: ativo === '' || ativo === 'TRUE' || ativo === 'VERDADEIRO',
            is_admin: isAdmin,
        };
    });

// Logins que viram o mesmo após normalizar (ex.: "dranatáliafaria" e "dranataliafaria"): fica o ativo
const usuariosPorLogin = new Map();
for (const u of todosUsuarios) {
    const atual = usuariosPorLogin.get(u.username);
    if (atual) {
        const [fica, sai] = !atual.ativo && u.ativo ? [u, atual] : [atual, u];
        usuariosPorLogin.set(u.username, fica);
        avisos.push(`Login "${sai.original}" duplica "${fica.original}" após normalizar — mantido só "${fica.original}"`);
    } else {
        usuariosPorLogin.set(u.username, u);
    }
}
const usuarios = [...usuariosPorLogin.values()];

// ── Resumo ───────────────────────────────────────────────────────────────

console.log(`\nUsuários na planilha: ${usuarios.length}`);
usuarios.forEach(u => {
    const renomeado = u.original !== u.username ? ` (login era "${u.original}")` : '';
    console.log(`  ${u.username}${renomeado} — ${u.profissional}${u.is_admin ? ' [admin]' : ''}${u.ativo ? '' : ' [inativo]'}`);
});

const porStatus = {};
finalizacoes.forEach(f => { porStatus[f.status] = (porStatus[f.status] || 0) + 1; });
console.log(`\nFinalizações na planilha: ${finalizacoes.length} (${repetidasNaPlanilha} repetidas entre abas descartadas)`, porStatus);
console.log(`Com observação (status original era texto livre): ${finalizacoes.filter(f => f.observacao).length}`);
if (avisos.length) console.log('\nAvisos:\n  ' + avisos.join('\n  '));

if (DRY_RUN) {
    console.log('\n--dry-run: nada foi gravado.');
    process.exit(0);
}

// ── Gravação ─────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.DATABASE_URL;
const { SUPABASE_SECRET_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) sairComErro('Defina DATABASE_URL e SUPABASE_SECRET_KEY no .env.');

const sb = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, { auth: { persistSession: false } });

// Usuários: só cria os que ainda não existem (não mexe em senha/perfil já editados no sistema)
const emailsExistentes = new Set();
for (let pagina = 1; ; pagina++) {
    const { data, error } = await sb.auth.admin.listUsers({ page: pagina, perPage: 1000 });
    if (error) sairComErro(error.message);
    data.users.forEach(u => emailsExistentes.add(u.email));
    if (data.users.length < 1000) break;
}

let usuariosCriados = 0;
for (const u of usuarios) {
    const email = `${u.username}@${DOMINIO_LOGIN}`;
    if (emailsExistentes.has(email)) continue;

    const { data, error } = await sb.auth.admin.createUser({
        email, password: PREFIXO_SENHA + u.senha, email_confirm: true,
    });
    if (error) sairComErro(`Usuário ${u.username}: ${error.message}`);

    const { error: erroPerfil } = await sb.from('usuarios').insert({
        id: data.user.id, username: u.username, profissional: u.profissional,
        unidade: u.unidade, ativo: u.ativo, is_admin: u.is_admin,
    });
    if (erroPerfil) sairComErro(`Perfil ${u.username}: ${erroPerfil.message}`);
    usuariosCriados++;
}
console.log(`\nUsuários criados: ${usuariosCriados} (já existiam: ${usuarios.length - usuariosCriados})`);

// Finalizações: só insere as que ainda não estão no banco
const chavesExistentes = new Set();
for (let inicio = 0; ; inicio += 1000) {
    const { data, error } = await sb.from('finalizacoes').select('created_at, paciente').order('id').range(inicio, inicio + 999);
    if (error) sairComErro(error.message);
    data.forEach(f => chavesExistentes.add(chave(f.created_at, f.paciente)));
    if (data.length < 1000) break;
}

const novas = finalizacoes
    .filter(f => !chavesExistentes.has(chave(f.created_at, f.paciente)))
    .sort((a, b) => a.created_at.localeCompare(b.created_at));

for (let i = 0; i < novas.length; i += 500) {
    const { error } = await sb.from('finalizacoes').insert(novas.slice(i, i + 500));
    if (error) sairComErro(`Lote ${i}–${i + 499}: ${error.message}`);
    console.log(`  ${Math.min(i + 500, novas.length)}/${novas.length} finalizações novas`);
}

console.log(`\nMigração concluída: ${novas.length} finalizações novas (já existiam: ${finalizacoes.length - novas.length}).`);

function sairComErro(msg) {
    console.error('ERRO: ' + msg);
    process.exit(1);
}
