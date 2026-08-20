-- Migration 11: Sistema de Códigos de Convite e Gestão de Membros da Família
-- Permite que cônjuges e membros entrem na mesma família compartilhada

-- 1. Adicionar coluna invite_code na tabela families
ALTER TABLE public.families 
ADD COLUMN IF NOT EXISTS invite_code VARCHAR(12) UNIQUE;

-- Função auxiliar para gerar código único aleatório de 6 caracteres (Ex: FAM-7X9K)
CREATE OR REPLACE FUNCTION public.generate_unique_invite_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    result TEXT := 'FAM-';
    i INTEGER;
    code_exists BOOLEAN;
BEGIN
    LOOP
        result := 'FAM-';
        FOR i IN 1..4 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;
        
        SELECT EXISTS(SELECT 1 FROM public.families WHERE invite_code = result) INTO code_exists;
        IF NOT code_exists THEN
            RETURN result;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Preencher invite_code para famílias existentes que não possuem
UPDATE public.families 
SET invite_code = public.generate_unique_invite_code()
WHERE invite_code IS NULL;

-- Tornar not null e com default após preencher existentes
ALTER TABLE public.families 
ALTER COLUMN invite_code SET NOT NULL,
ALTER COLUMN invite_code SET DEFAULT public.generate_unique_invite_code();

-- 2. Trigger no auth.users para criar automaticamente perfil e vincular à família no signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    v_invite_code TEXT;
    v_target_family_id UUID;
    v_display_name TEXT;
    v_family_name TEXT;
    v_role TEXT := 'member';
BEGIN
    v_display_name := COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1));
    v_invite_code := UPPER(TRIM(COALESCE(NEW.raw_user_meta_data->>'invite_code', '')));
    v_family_name := TRIM(COALESCE(NEW.raw_user_meta_data->>'family_name', ''));

    -- Se um código de convite foi fornecido, tenta localizar a família
    IF v_invite_code <> '' THEN
        SELECT id INTO v_target_family_id 
        FROM public.families 
        WHERE UPPER(invite_code) = v_invite_code;
    END IF;

    -- Se encontrou a família pelo convite
    IF v_target_family_id IS NOT NULL THEN
        v_role := 'member';
    ELSE
        -- Cria uma nova família se não informou código ou código inexistente
        IF v_family_name = '' THEN
            v_family_name := 'Família ' || v_display_name;
        END IF;

        INSERT INTO public.families (name, invite_code)
        VALUES (v_family_name, public.generate_unique_invite_code())
        RETURNING id INTO v_target_family_id;

        v_role := 'admin';
    END IF;

    -- Cria o perfil do usuário
    INSERT INTO public.profiles (id, family_id, display_name, role)
    VALUES (NEW.id, v_target_family_id, v_display_name, v_role)
    ON CONFLICT (id) DO UPDATE
    SET display_name = EXCLUDED.display_name,
        family_id = EXCLUDED.family_id,
        role = EXCLUDED.role;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ativar o gatilho no auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Função RPC para obter detalhes da família e membros ativos
CREATE OR REPLACE FUNCTION public.get_family_details()
RETURNS JSONB AS $$
DECLARE
    v_family_id UUID;
    v_result JSONB;
BEGIN
    v_family_id := public.get_my_family_id();

    IF v_family_id IS NULL THEN
        RETURN '{}'::jsonb;
    END IF;

    SELECT jsonb_build_object(
        'family_id', f.id,
        'family_name', f.name,
        'invite_code', f.invite_code,
        'created_at', f.created_at,
        'members', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', p.id,
                'display_name', p.display_name,
                'role', p.role,
                'avatar_url', p.avatar_url,
                'created_at', p.created_at,
                'is_current_user', (p.id = auth.uid())
            ) ORDER BY (p.role = 'admin') DESC, p.created_at ASC)
            FROM public.profiles p
            WHERE p.family_id = f.id
        ), '[]'::jsonb)
    ) INTO v_result
    FROM public.families f
    WHERE f.id = v_family_id;

    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. Função RPC para vincular usuário já logado a uma família por código de convite
CREATE OR REPLACE FUNCTION public.join_family_by_code(p_invite_code TEXT)
RETURNS JSONB AS $$
DECLARE
    v_target_family RECORD;
    v_old_family_id UUID;
BEGIN
    -- Localiza a família pelo código
    SELECT id, name, invite_code INTO v_target_family
    FROM public.families
    WHERE UPPER(invite_code) = UPPER(TRIM(p_invite_code));

    IF v_target_family.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Código de convite não encontrado ou inválido.');
    END IF;

    SELECT family_id INTO v_old_family_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_old_family_id = v_target_family.id THEN
        RETURN jsonb_build_object('success', true, 'message', 'Você já faz parte desta família!');
    END IF;

    -- Atualiza o perfil para a nova família
    UPDATE public.profiles
    SET family_id = v_target_family.id,
        role = 'member'
    WHERE id = auth.uid();

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Vinculado com sucesso à ' || v_target_family.name,
        'family_name', v_target_family.name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
