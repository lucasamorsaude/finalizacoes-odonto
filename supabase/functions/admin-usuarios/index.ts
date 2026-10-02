// Edge Function: operações de usuário que exigem a chave secreta (criar login e trocar senha).
// Só executa para quem está logado como admin ativo.
import { createClient } from 'npm:@supabase/supabase-js@2';

// Precisam ser iguais aos de supabase-client.js
const DOMINIO_LOGIN = 'finalizacoes.local';
const PREFIXO_SENHA = 'odonto:';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function resposta(status: number, corpo: Record<string, unknown>) {
    return new Response(JSON.stringify(corpo), {
        status,
        headers: { ...CORS, 'Content-Type': 'application/json' },
    });
}

function normalizarUsuario(usuario: string) {
    return usuario.normalize('NFD').replace(/[̀-ͯ]/g, '')
        .trim().toLowerCase().replace(/\s+/g, '.');
}

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

    const admin = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        { auth: { persistSession: false } },
    );

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer /, '');
    const { data: { user } } = await admin.auth.getUser(token);
    if (!user) return resposta(401, { erro: 'Sessão inválida. Faça login novamente.' });

    const { data: chamador } = await admin.from('usuarios')
        .select('is_admin, ativo').eq('id', user.id).maybeSingle();
    if (!chamador?.is_admin || !chamador.ativo) return resposta(403, { erro: 'Acesso negado.' });

    const corpo = await req.json().catch(() => ({}));

    if (corpo.acao === 'criar') {
        const username = normalizarUsuario(String(corpo.username ?? ''));
        const senha = String(corpo.senha ?? '');
        const profissional = String(corpo.profissional ?? '').trim();

        if (!/^[a-z0-9._-]+$/.test(username)) {
            return resposta(400, { erro: 'Usuário deve ter só letras, números, ponto, hífen ou _.' });
        }
        if (!senha) return resposta(400, { erro: 'Informe uma senha.' });
        if (!profissional) return resposta(400, { erro: 'Informe o nome do profissional.' });

        const { data: criado, error: erroAuth } = await admin.auth.admin.createUser({
            email: `${username}@${DOMINIO_LOGIN}`,
            password: PREFIXO_SENHA + senha,
            email_confirm: true,
        });
        if (erroAuth) {
            const jaExiste = /already/i.test(erroAuth.message);
            return resposta(400, { erro: jaExiste ? 'Já existe um usuário com esse login.' : erroAuth.message });
        }

        const { error: erroPerfil } = await admin.from('usuarios').insert({
            id: criado.user.id,
            username,
            profissional,
            unidade: corpo.unidade || null,
            is_admin: Boolean(corpo.is_admin),
        });
        if (erroPerfil) {
            await admin.auth.admin.deleteUser(criado.user.id);
            return resposta(400, { erro: erroPerfil.message });
        }

        return resposta(200, { mensagem: `Usuário ${username} criado.` });
    }

    if (corpo.acao === 'senha') {
        const senha = String(corpo.senha ?? '');
        if (!corpo.id || !senha) return resposta(400, { erro: 'Informe usuário e nova senha.' });

        const { error } = await admin.auth.admin.updateUserById(corpo.id, { password: PREFIXO_SENHA + senha });
        if (error) return resposta(400, { erro: error.message });

        return resposta(200, { mensagem: 'Senha atualizada.' });
    }

    return resposta(400, { erro: 'Ação inválida.' });
});
