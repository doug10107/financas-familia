-- Migration 3: Transações Financeiras
-- Receitas e Despesas com suporte a recorrência e anexos

CREATE TABLE public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    type TEXT NOT NULL CHECK (type IN ('receita', 'despesa')),
    description TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pago', 'pendente', 'cancelado')),
    is_recurring BOOLEAN NOT NULL DEFAULT false,
    recurrence_rule JSONB,
    parent_recurring_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
    attachment_path TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_transactions_family_date ON public.transactions(family_id, date DESC);
CREATE INDEX idx_transactions_family_type ON public.transactions(family_id, type);
CREATE INDEX idx_transactions_family_status ON public.transactions(family_id, status);
CREATE INDEX idx_transactions_recurring ON public.transactions(is_recurring) WHERE is_recurring = true;

CREATE TRIGGER set_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
