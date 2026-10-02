// Configuração do Supabase (Project Settings → API).
// A chave publishable/anon é pública por design: quem protege os dados são as políticas RLS do banco.
const SUPABASE_URL = 'https://vxeuacxxzjmpqlqgnoqd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lL0MnPD8l_7krrqYrU5EKw_OE3yn-Mm';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// O login continua sendo por "usuário"; por baixo o Supabase Auth usa e-mail.
// Estes valores precisam ser iguais na Edge Function e no script de migração.
const DOMINIO_LOGIN = 'finalizacoes.local';
// O Supabase exige senha com 6+ caracteres; o prefixo mantém válidas as senhas curtas já em uso.
const PREFIXO_SENHA = 'odonto:';

const STATUS_OPCOES = ['Pendente', 'Aguardando liberação', 'Aguardando pagamento', 'Finalizado'];

function normalizarUsuario(usuario) {
    return usuario.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim().toLowerCase().replace(/\s+/g, '.');
}

function emailDoUsuario(usuario) {
    return `${normalizarUsuario(usuario)}@${DOMINIO_LOGIN}`;
}

function escapeHtml(valor) {
    return String(valor ?? '').replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// Retorna o perfil do usuário logado, ou null se não houver sessão válida/ativa
async function carregarPerfil() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;

    const { data: perfil, error } = await sb.from('usuarios')
        .select('id, username, profissional, unidade, ativo, is_admin')
        .eq('id', session.user.id)
        .maybeSingle();

    if (error || !perfil || !perfil.ativo) return null;
    return perfil;
}

async function sair() {
    await sb.auth.signOut();
    window.location.href = 'login.html';
}
