-- Migration 6: Row Level Security (RLS)
-- Garante que cada família só acesse seus próprios dados

ALTER TABLE public.families ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investment_types ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_family_id()
RETURNS UUID AS $$
    SELECT family_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- FAMILIES
CREATE POLICY "Membros veem sua familia"
    ON public.families FOR SELECT
    USING (id = public.get_my_family_id());

-- PROFILES
CREATE POLICY "Membros veem perfis da familia"
    ON public.profiles FOR SELECT
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Usuario edita proprio perfil"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid());

-- CATEGORIES
CREATE POLICY "Membros veem categorias da familia"
    ON public.categories FOR SELECT
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros criam categorias na familia"
    ON public.categories FOR INSERT
    WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "Membros editam categorias da familia"
    ON public.categories FOR UPDATE
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros deletam categorias nao padrao"
    ON public.categories FOR DELETE
    USING (family_id = public.get_my_family_id() AND is_default = false);

-- TRANSACTIONS
CREATE POLICY "Membros veem transacoes da familia"
    ON public.transactions FOR SELECT
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros criam transacoes na familia"
    ON public.transactions FOR INSERT
    WITH CHECK (family_id = public.get_my_family_id() AND user_id = auth.uid());

CREATE POLICY "Membros editam transacoes da familia"
    ON public.transactions FOR UPDATE
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros deletam transacoes da familia"
    ON public.transactions FOR DELETE
    USING (family_id = public.get_my_family_id());

-- GOALS
CREATE POLICY "Membros veem metas da familia"
    ON public.goals FOR SELECT
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros criam metas na familia"
    ON public.goals FOR INSERT
    WITH CHECK (family_id = public.get_my_family_id() AND user_id = auth.uid());

CREATE POLICY "Membros editam metas da familia"
    ON public.goals FOR UPDATE
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros deletam metas da familia"
    ON public.goals FOR DELETE
    USING (family_id = public.get_my_family_id());

-- GOAL_CONTRIBUTIONS
CREATE POLICY "Membros veem aportes das metas da familia"
    ON public.goal_contributions FOR SELECT
    USING (goal_id IN (
        SELECT id FROM public.goals WHERE family_id = public.get_my_family_id()
    ));

CREATE POLICY "Membros criam aportes nas metas da familia"
    ON public.goal_contributions FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        goal_id IN (SELECT id FROM public.goals WHERE family_id = public.get_my_family_id())
    );

CREATE POLICY "Membros deletam proprios aportes"
    ON public.goal_contributions FOR DELETE
    USING (user_id = auth.uid());

-- INVESTMENTS
CREATE POLICY "Membros veem investimentos da familia"
    ON public.investments FOR SELECT
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros criam investimentos na familia"
    ON public.investments FOR INSERT
    WITH CHECK (family_id = public.get_my_family_id() AND user_id = auth.uid());

CREATE POLICY "Membros editam investimentos da familia"
    ON public.investments FOR UPDATE
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros deletam investimentos da familia"
    ON public.investments FOR DELETE
    USING (family_id = public.get_my_family_id());

-- INVESTMENT_ENTRIES
CREATE POLICY "Membros veem movimentacoes de investimentos da familia"
    ON public.investment_entries FOR SELECT
    USING (investment_id IN (
        SELECT id FROM public.investments WHERE family_id = public.get_my_family_id()
    ));

CREATE POLICY "Membros criam movimentacoes"
    ON public.investment_entries FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        investment_id IN (SELECT id FROM public.investments WHERE family_id = public.get_my_family_id())
    );

CREATE POLICY "Membros deletam proprias movimentacoes"
    ON public.investment_entries FOR DELETE
    USING (user_id = auth.uid());

-- INVESTMENT_TYPES
CREATE POLICY "Membros veem tipos de investimento da familia"
    ON public.investment_types FOR SELECT
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros criam tipos de investimento"
    ON public.investment_types FOR INSERT
    WITH CHECK (family_id = public.get_my_family_id());
