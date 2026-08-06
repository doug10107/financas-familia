-- Migration 5: Investimentos e Movimentações
-- Controle de aportes, resgates e rendimentos por tipo de ativo

CREATE TABLE public.investment_types (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'account_balance',
    color TEXT NOT NULL DEFAULT '#0058be',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    type_id UUID REFERENCES public.investment_types(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    institution TEXT,
    current_balance NUMERIC(14, 2) NOT NULL DEFAULT 0,
    total_invested NUMERIC(14, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investments_family ON public.investments(family_id);

CREATE TRIGGER set_investments_updated_at
    BEFORE UPDATE ON public.investments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TABLE public.investment_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investment_id UUID NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    type TEXT NOT NULL CHECK (type IN ('aporte', 'resgate', 'rendimento')),
    amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_investment_entries_investment ON public.investment_entries(investment_id);

CREATE OR REPLACE FUNCTION public.update_investment_balance()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.investments SET
        current_balance = (
            SELECT COALESCE(SUM(
                CASE WHEN type IN ('aporte', 'rendimento') THEN amount
                     WHEN type = 'resgate' THEN -amount
                END
            ), 0)
            FROM public.investment_entries
            WHERE investment_id = COALESCE(NEW.investment_id, OLD.investment_id)
        ),
        total_invested = (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.investment_entries
            WHERE investment_id = COALESCE(NEW.investment_id, OLD.investment_id)
            AND type = 'aporte'
        )
    WHERE id = COALESCE(NEW.investment_id, OLD.investment_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_investment_entry_change
    AFTER INSERT OR UPDATE OR DELETE ON public.investment_entries
    FOR EACH ROW EXECUTE FUNCTION public.update_investment_balance();

CREATE OR REPLACE FUNCTION public.seed_default_investment_types()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.investment_types (family_id, name, icon, color) VALUES
        (NEW.id, 'Renda Fixa', 'lock', '#10b981'),
        (NEW.id, 'Ações', 'show_chart', '#3b82f6'),
        (NEW.id, 'FIIs', 'apartment', '#8b5cf6'),
        (NEW.id, 'Tesouro Direto', 'account_balance', '#f59e0b'),
        (NEW.id, 'Criptomoedas', 'currency_bitcoin', '#f97316'),
        (NEW.id, 'Poupança', 'savings', '#06b6d4');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_family_created_seed_investments
    AFTER INSERT ON public.families
    FOR EACH ROW EXECUTE FUNCTION public.seed_default_investment_types();
