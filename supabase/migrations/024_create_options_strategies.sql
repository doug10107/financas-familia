-- Migration 024: Estruturas para Estratégias de Opções B3 Sincronizadas
-- Permite acompanhamento de travas (baixa, alta), venda coberta, puts e spreads
-- sincronizados na nuvem entre Web Desktop e Mobile Phone para toda a família.

CREATE TABLE IF NOT EXISTS public.options_strategies (
    id TEXT PRIMARY KEY,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    underlying_ticker VARCHAR(20) NOT NULL,
    underlying_price NUMERIC(14, 4) NOT NULL DEFAULT 0,
    strategy_category VARCHAR(50) NOT NULL DEFAULT 'personalizada',
    legs JSONB NOT NULL DEFAULT '[]'::jsonb,
    quantity NUMERIC(14, 4) NOT NULL DEFAULT 100,
    entry_cost_per_unit NUMERIC(14, 4) NOT NULL DEFAULT 0,
    total_entry_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    target_profit_50 NUMERIC(14, 4) NOT NULL DEFAULT 0,
    target_profit_80 NUMERIC(14, 4) NOT NULL DEFAULT 0,
    stop_loss_price NUMERIC(14, 4) NOT NULL DEFAULT 0,
    max_profit_per_unit NUMERIC(14, 4),
    underlying_dy_5y NUMERIC(10, 2),
    status VARCHAR(30) NOT NULL DEFAULT 'active', -- 'active', 'closed', 'target_hit', 'stop_hit'
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_options_strategies_family ON public.options_strategies(family_id);
CREATE INDEX IF NOT EXISTS idx_options_strategies_status ON public.options_strategies(status);

-- RLS (Row Level Security)
ALTER TABLE public.options_strategies ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'options_strategies' AND policyname = 'Família visualiza opções') THEN
        CREATE POLICY "Família visualiza opções"
            ON public.options_strategies FOR SELECT
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'options_strategies' AND policyname = 'Família cria opções') THEN
        CREATE POLICY "Família cria opções"
            ON public.options_strategies FOR INSERT
            WITH CHECK (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'options_strategies' AND policyname = 'Família atualiza opções') THEN
        CREATE POLICY "Família atualiza opções"
            ON public.options_strategies FOR UPDATE
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'options_strategies' AND policyname = 'Família remove opções') THEN
        CREATE POLICY "Família remove opções"
            ON public.options_strategies FOR DELETE
            USING (family_id = public.get_my_family_id());
    END IF;
END $$;

-- Trigger para updated_at automático
DROP TRIGGER IF EXISTS set_options_strategies_updated_at ON public.options_strategies;
CREATE TRIGGER set_options_strategies_updated_at
    BEFORE UPDATE ON public.options_strategies
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
