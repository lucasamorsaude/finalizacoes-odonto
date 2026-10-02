// Conexão com o Supabase e constantes de domínio.
// A chave publishable é pública por design: quem protege os dados são as políticas RLS do banco.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';

const SUPABASE_URL = 'https://vxeuacxxzjmpqlqgnoqd.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lL0MnPD8l_7krrqYrU5EKw_OE3yn-Mm';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Cliente sem sessão: o formulário público sempre registra como anônimo,
// mesmo num computador onde alguém esteja logado.
export const sbAnonimo = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: 'finaliza-anonimo' },
});

// O login é por "usuário"; por baixo o Supabase Auth usa e-mail.
// Precisam ser iguais na Edge Function e no script de migração.
const DOMINIO_LOGIN = 'finalizacoes.local';
export const PREFIXO_SENHA = 'odonto:';

export const UNIDADES = ['SJDR', 'SJDR APOIO'];

export const STATUS = {
    PENDENTE: 'Pendente',
    LIBERACAO: 'Aguardando liberação',
    PAGAMENTO: 'Aguardando pagamento',
    FINALIZADO: 'Finalizado',
    RECUSADO: 'Recusado',
};
export const STATUS_ABERTOS = [STATUS.PENDENTE, STATUS.LIBERACAO, STATUS.PAGAMENTO];
export const STATUS_TODOS = [...STATUS_ABERTOS, STATUS.FINALIZADO, STATUS.RECUSADO];

export function normalizarUsuario(usuario) {
    return usuario.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim().toLowerCase().replace(/\s+/g, '.');
}

export function emailDoUsuario(usuario) {
    return `${normalizarUsuario(usuario)}@${DOMINIO_LOGIN}`;
}

// Perfil do usuário logado, ou null se não houver sessão válida/ativa
export async function carregarPerfil() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;

    const { data: perfil, error } = await sb.from('usuarios')
        .select('id, username, profissional, unidade, ativo, is_admin')
        .eq('id', session.user.id)
        .maybeSingle();

    if (error || !perfil || !perfil.ativo) return null;
    return perfil;
}

export async function sair() {
    await sb.auth.signOut();
    window.location.href = 'login.html';
}
