-- Migration 26: Função RPC para Administrador remover/desvincular membro da família
-- Remove o membro da família compartilhada e transfere para um espaço/família individual própria

CREATE OR REPLACE FUNCTION public.remove_family_member(p_member_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_admin_family_id UUID;
    v_admin_role TEXT;
    v_target_profile RECORD;
    v_new_family_id UUID;
BEGIN
    -- Obter família e papel do usuário logado que solicitou a remoção
    SELECT family_id, role INTO v_admin_family_id, v_admin_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_admin_family_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuário não autenticado ou sem família.');
    END IF;

    IF v_admin_role <> 'admin' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Apenas administradores podem remover membros da família.');
    END IF;

    IF p_member_id = auth.uid() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Você não pode remover a si mesmo da família.');
    END IF;

    -- Verificar se o membro pertence à mesma família do admin
    SELECT * INTO v_target_profile
    FROM public.profiles
    WHERE id = p_member_id AND family_id = v_admin_family_id;

    IF v_target_profile.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Membro não encontrado nesta família.');
    END IF;

    -- Desvincular membro movendo-o para uma nova família própria e independente
    INSERT INTO public.families (name, invite_code)
    VALUES ('Família ' || v_target_profile.display_name, public.generate_unique_invite_code())
    RETURNING id INTO v_new_family_id;

    UPDATE public.profiles
    SET family_id = v_new_family_id,
        role = 'admin',
        updated_at = now()
    WHERE id = p_member_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Membro "' || v_target_profile.display_name || '" desvinculado da família com sucesso.'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
