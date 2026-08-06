-- Migration 7: Cartões de Crédito e Parcelamentos

CREATE TABLE public.credit_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    limit_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    closing_day INT NOT NULL CHECK (closing_day BETWEEN 1 AND 31),
    due_day INT NOT NULL CHECK (due_day BETWEEN 1 AND 31),
    color TEXT NOT NULL DEFAULT '#8b5cf6',
    icon TEXT NOT NULL DEFAULT 'credit_card',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_cards_family ON public.credit_cards(family_id);

CREATE TRIGGER set_credit_cards_updated_at
    BEFORE UPDATE ON public.credit_cards
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Adicionando colunas de cartão de crédito e parcelamento nas transações
ALTER TABLE public.transactions
ADD COLUMN credit_card_id UUID REFERENCES public.credit_cards(id) ON DELETE CASCADE,
ADD COLUMN installment_group_id UUID,
ADD COLUMN current_installment INT,
ADD COLUMN total_installments INT;

-- RLS
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Membros veem cartoes da familia"
    ON public.credit_cards FOR SELECT
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros criam cartoes na familia"
    ON public.credit_cards FOR INSERT
    WITH CHECK (family_id = public.get_my_family_id());

CREATE POLICY "Membros editam cartoes da familia"
    ON public.credit_cards FOR UPDATE
    USING (family_id = public.get_my_family_id());

CREATE POLICY "Membros deletam cartoes da familia"
    ON public.credit_cards FOR DELETE
    USING (family_id = public.get_my_family_id());
