-- Migration 023: Calculadora de Imposto de Renda (IR) & DARF para Investimentos
-- Suporte completo a Notas de Corretagem SINACOR (íon Itaú, XP, Clear, BTG, NuInvest, etc.)
-- Segregação de operações: Ações Swing Trade, Day Trade, FIIs/FIAGRO, ETFs, BDRs
-- Controle de Preço Médio, Dedução de Custos B3, IRRF "Dedo-Duro" e Prejuízos Acumulados

CREATE TABLE IF NOT EXISTS public.brokerage_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    broker_name VARCHAR(100) NOT NULL DEFAULT 'íon Itaú',
    note_number VARCHAR(50),
    trading_date DATE NOT NULL,
    clearing_date DATE,
    total_operations NUMERIC(15,2) DEFAULT 0,
    net_amount NUMERIC(15,2) DEFAULT 0,
    settlement_fee NUMERIC(10,2) DEFAULT 0,
    registration_fee NUMERIC(10,2) DEFAULT 0,
    emoluments NUMERIC(10,2) DEFAULT 0,
    brokerage_fee NUMERIC(10,2) DEFAULT 0,
    taxes NUMERIC(10,2) DEFAULT 0,
    other_expenses NUMERIC(10,2) DEFAULT 0,
    irrf_amount NUMERIC(10,2) DEFAULT 0,
    irrf_base NUMERIC(15,2) DEFAULT 0,
    raw_file_name VARCHAR(255),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.brokerage_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    note_id UUID NOT NULL REFERENCES public.brokerage_notes(id) ON DELETE CASCADE,
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    ticker VARCHAR(20) NOT NULL,
    asset_name VARCHAR(255),
    asset_category VARCHAR(50) NOT NULL DEFAULT 'Ações', -- 'Ações', 'FIIs', 'ETFs', 'BDRs', 'Opções', 'Futuros'
    operation_type VARCHAR(1) NOT NULL, -- 'C' (Compra) ou 'V' (Venda)
    market_type VARCHAR(30) DEFAULT 'VISTA', -- 'VISTA', 'FRACIONARIO', 'OPCAO', 'TERMO'
    quantity NUMERIC(15,4) NOT NULL,
    unit_price NUMERIC(15,4) NOT NULL,
    total_price NUMERIC(15,2) NOT NULL,
    apportioned_costs NUMERIC(10,2) DEFAULT 0,
    effective_total NUMERIC(15,2) NOT NULL,
    effective_unit_price NUMERIC(15,4) NOT NULL,
    is_day_trade BOOLEAN DEFAULT FALSE,
    trading_date DATE NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tax_monthly_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    period_month_year VARCHAR(7) NOT NULL, -- 'YYYY-MM'
    
    -- Operações Comuns (Swing Trade em Ações)
    sales_swing_trade NUMERIC(15,2) DEFAULT 0,
    cost_swing_trade NUMERIC(15,2) DEFAULT 0,
    profit_swing_trade NUMERIC(15,2) DEFAULT 0,
    is_swing_exempt BOOLEAN DEFAULT FALSE,
    
    -- Day Trade
    sales_day_trade NUMERIC(15,2) DEFAULT 0,
    cost_day_trade NUMERIC(15,2) DEFAULT 0,
    profit_day_trade NUMERIC(15,2) DEFAULT 0,
    
    -- Fundos Imobiliários e FIAGRO
    sales_fiis NUMERIC(15,2) DEFAULT 0,
    cost_fiis NUMERIC(15,2) DEFAULT 0,
    profit_fiis NUMERIC(15,2) DEFAULT 0,
    
    -- ETFs e BDRs
    sales_etfs NUMERIC(15,2) DEFAULT 0,
    cost_etfs NUMERIC(15,2) DEFAULT 0,
    profit_etfs NUMERIC(15,2) DEFAULT 0,
    
    -- Prejuízos compensados no mês
    loss_used_swing NUMERIC(15,2) DEFAULT 0,
    loss_used_day_trade NUMERIC(15,2) DEFAULT 0,
    loss_used_fiis NUMERIC(15,2) DEFAULT 0,
    
    -- Prejuízos restantes acumulados transportados para o mês seguinte
    loss_carry_swing NUMERIC(15,2) DEFAULT 0,
    loss_carry_day_trade NUMERIC(15,2) DEFAULT 0,
    loss_carry_fiis NUMERIC(15,2) DEFAULT 0,
    
    -- Impostos brutos calculados por caixinha
    tax_due_swing NUMERIC(15,2) DEFAULT 0, -- 15%
    tax_due_day_trade NUMERIC(15,2) DEFAULT 0, -- 20%
    tax_due_fiis NUMERIC(15,2) DEFAULT 0, -- 20%
    tax_due_etfs NUMERIC(15,2) DEFAULT 0, -- 15%
    total_tax_due NUMERIC(15,2) DEFAULT 0,
    
    -- Deduções de IRRF (Dedo-Duro) e DARF final
    irrf_month NUMERIC(10,2) DEFAULT 0,
    irrf_accumulated NUMERIC(10,2) DEFAULT 0,
    irrf_deducted NUMERIC(10,2) DEFAULT 0,
    darf_amount NUMERIC(15,2) DEFAULT 0,
    is_under_minimum BOOLEAN DEFAULT FALSE, -- DARF < R$ 10,00
    
    status VARCHAR(20) DEFAULT 'isento', -- 'isento', 'pendente', 'pago', 'prejuizo'
    due_date DATE,
    payment_date DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(family_id, period_month_year)
);

CREATE TABLE IF NOT EXISTS public.tax_loss_carry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    category VARCHAR(30) NOT NULL, -- 'swing_trade', 'day_trade', 'fiis'
    accumulated_loss NUMERIC(15,2) DEFAULT 0,
    accumulated_irrf NUMERIC(10,2) DEFAULT 0,
    reference_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(family_id, category)
);

-- Habilitar RLS
ALTER TABLE public.brokerage_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brokerage_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_monthly_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_loss_carry ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para brokerage_notes
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokerage_notes' AND policyname = 'Família visualiza notas de corretagem') THEN
        CREATE POLICY "Família visualiza notas de corretagem"
            ON public.brokerage_notes FOR SELECT
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokerage_notes' AND policyname = 'Família cria notas de corretagem') THEN
        CREATE POLICY "Família cria notas de corretagem"
            ON public.brokerage_notes FOR INSERT
            WITH CHECK (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokerage_notes' AND policyname = 'Família atualiza notas de corretagem') THEN
        CREATE POLICY "Família atualiza notas de corretagem"
            ON public.brokerage_notes FOR UPDATE
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokerage_notes' AND policyname = 'Família remove notas de corretagem') THEN
        CREATE POLICY "Família remove notas de corretagem"
            ON public.brokerage_notes FOR DELETE
            USING (family_id = public.get_my_family_id());
    END IF;
END $$;

-- Políticas de RLS para brokerage_orders
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokerage_orders' AND policyname = 'Família visualiza ordens de corretagem') THEN
        CREATE POLICY "Família visualiza ordens de corretagem"
            ON public.brokerage_orders FOR SELECT
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokerage_orders' AND policyname = 'Família cria ordens de corretagem') THEN
        CREATE POLICY "Família cria ordens de corretagem"
            ON public.brokerage_orders FOR INSERT
            WITH CHECK (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokerage_orders' AND policyname = 'Família atualiza ordens de corretagem') THEN
        CREATE POLICY "Família atualiza ordens de corretagem"
            ON public.brokerage_orders FOR UPDATE
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'brokerage_orders' AND policyname = 'Família remove ordens de corretagem') THEN
        CREATE POLICY "Família remove ordens de corretagem"
            ON public.brokerage_orders FOR DELETE
            USING (family_id = public.get_my_family_id());
    END IF;
END $$;

-- Políticas de RLS para tax_monthly_settlements
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_monthly_settlements' AND policyname = 'Família visualiza apuração de IR') THEN
        CREATE POLICY "Família visualiza apuração de IR"
            ON public.tax_monthly_settlements FOR SELECT
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_monthly_settlements' AND policyname = 'Família cria apuração de IR') THEN
        CREATE POLICY "Família cria apuração de IR"
            ON public.tax_monthly_settlements FOR INSERT
            WITH CHECK (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_monthly_settlements' AND policyname = 'Família atualiza apuração de IR') THEN
        CREATE POLICY "Família atualiza apuração de IR"
            ON public.tax_monthly_settlements FOR UPDATE
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_monthly_settlements' AND policyname = 'Família remove apuração de IR') THEN
        CREATE POLICY "Família remove apuração de IR"
            ON public.tax_monthly_settlements FOR DELETE
            USING (family_id = public.get_my_family_id());
    END IF;
END $$;

-- Políticas de RLS para tax_loss_carry
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_loss_carry' AND policyname = 'Família visualiza prejuízo acumulado') THEN
        CREATE POLICY "Família visualiza prejuízo acumulado"
            ON public.tax_loss_carry FOR SELECT
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_loss_carry' AND policyname = 'Família cria prejuízo acumulado') THEN
        CREATE POLICY "Família cria prejuízo acumulado"
            ON public.tax_loss_carry FOR INSERT
            WITH CHECK (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_loss_carry' AND policyname = 'Família atualiza prejuízo acumulado') THEN
        CREATE POLICY "Família atualiza prejuízo acumulado"
            ON public.tax_loss_carry FOR UPDATE
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tax_loss_carry' AND policyname = 'Família remove prejuízo acumulado') THEN
        CREATE POLICY "Família remove prejuízo acumulado"
            ON public.tax_loss_carry FOR DELETE
            USING (family_id = public.get_my_family_id());
    END IF;
END $$;
