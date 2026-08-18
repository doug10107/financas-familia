-- 010_create_benefits_and_shopping.sql

-- 1. BENEFIT CARDS (VA & VR)
CREATE TABLE IF NOT EXISTS public.benefit_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('va', 'vr')),
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
    recharge_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    recharge_day INT NOT NULL CHECK (recharge_day BETWEEN 1 AND 31),
    color TEXT NOT NULL DEFAULT '#10b981',
    icon TEXT NOT NULL DEFAULT 'restaurant',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benefit_cards_family ON public.benefit_cards(family_id);

CREATE TRIGGER set_benefit_cards_updated_at
    BEFORE UPDATE ON public.benefit_cards
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 2. BENEFIT TRANSACTIONS (Extrato de Gastos/Recargas de Vales)
CREATE TABLE IF NOT EXISTS public.benefit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id UUID NOT NULL REFERENCES public.benefit_cards(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL CHECK (type IN ('debito', 'recarga')),
    category_name TEXT DEFAULT 'Alimentação',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_benefit_transactions_card ON public.benefit_transactions(card_id);

-- 3. SHOPPING LISTS (Listas de Compras)
CREATE TABLE IF NOT EXISTS public.shopping_lists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    benefit_card_id UUID REFERENCES public.benefit_cards(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_lists_family ON public.shopping_lists(family_id);

CREATE TRIGGER set_shopping_lists_updated_at
    BEFORE UPDATE ON public.shopping_lists
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 4. SHOPPING ITEMS (Itens da Lista de Compras)
CREATE TABLE IF NOT EXISTS public.shopping_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    list_id UUID NOT NULL REFERENCES public.shopping_lists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'Alimentação',
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1,
    estimated_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    actual_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    is_checked BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shopping_items_list ON public.shopping_items(list_id);

-- 5. RLS POLICIES

-- Benefit Cards RLS
ALTER TABLE public.benefit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem cartoes de beneficio da familia"
    ON public.benefit_cards FOR SELECT
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros criam cartoes de beneficio na familia"
    ON public.benefit_cards FOR INSERT
    WITH CHECK (family_id = public.get_my_family_id() AND user_id = auth.uid());

CREATE POLICY "Membros editam cartoes de beneficio da familia"
    ON public.benefit_cards FOR UPDATE
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros deletam cartoes de beneficio da familia"
    ON public.benefit_cards FOR DELETE
    USING (family_id = public.get_my_family_id());

-- Benefit Transactions RLS
ALTER TABLE public.benefit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem transacoes de beneficio da familia"
    ON public.benefit_transactions FOR SELECT
    USING (card_id IN (
        SELECT id FROM public.benefit_cards WHERE family_id = public.get_my_family_id()
    ));

CREATE POLICY "Membros criam transacoes de beneficio"
    ON public.benefit_transactions FOR INSERT
    WITH CHECK (
        user_id = auth.uid() AND
        card_id IN (SELECT id FROM public.benefit_cards WHERE family_id = public.get_my_family_id())
    );

CREATE POLICY "Membros deletam transacoes de beneficio"
    ON public.benefit_transactions FOR DELETE
    USING (card_id IN (
        SELECT id FROM public.benefit_cards WHERE family_id = public.get_my_family_id()
    ));

-- Shopping Lists RLS
ALTER TABLE public.shopping_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem listas de compras da familia"
    ON public.shopping_lists FOR SELECT
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros criam listas de compras na familia"
    ON public.shopping_lists FOR INSERT
    WITH CHECK (family_id = public.get_my_family_id() AND user_id = auth.uid());

CREATE POLICY "Membros editam listas de compras da familia"
    ON public.shopping_lists FOR UPDATE
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros deletam listas de compras da familia"
    ON public.shopping_lists FOR DELETE
    USING (family_id = public.get_my_family_id());

-- Shopping Items RLS
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem itens de compras da familia"
    ON public.shopping_items FOR SELECT
    USING (list_id IN (
        SELECT id FROM public.shopping_lists WHERE family_id = public.get_my_family_id()
    ));

CREATE POLICY "Membros criam itens de compras"
    ON public.shopping_items FOR INSERT
    WITH CHECK (list_id IN (
        SELECT id FROM public.shopping_lists WHERE family_id = public.get_my_family_id()
    ));

CREATE POLICY "Membros editam itens de compras"
    ON public.shopping_items FOR UPDATE
    USING (list_id IN (
        SELECT id FROM public.shopping_lists WHERE family_id = public.get_my_family_id()
    ));

CREATE POLICY "Membros deletam itens de compras"
    ON public.shopping_items FOR DELETE
    USING (list_id IN (
        SELECT id FROM public.shopping_lists WHERE family_id = public.get_my_family_id()
    ));
