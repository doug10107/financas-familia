-- Migration 022: Módulo de Planejamento e Previsão Detalhada de Gastos (TrabeePocket Style)
-- Permite orçamentos granulares (Viagens, Reformas, Casamentos, Carro, etc.)
-- e cálculo de metas realistas vinculadas ao aporte mensal.

CREATE TABLE IF NOT EXISTS public.expense_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    category_type VARCHAR(50) NOT NULL DEFAULT 'viagem', -- 'viagem', 'reforma', 'evento', 'veiculo', 'educacao', 'bebe', 'outro'
    icon VARCHAR(50) DEFAULT 'flight_takeoff',
    color VARCHAR(20) DEFAULT '#0ea5e9',
    status VARCHAR(30) DEFAULT 'planejamento', -- 'planejamento', 'em_andamento', 'concluido', 'arquivado'
    
    -- Configurações de orçamento e moeda (Estilo TrabeePocket)
    currency VARCHAR(10) DEFAULT 'BRL',
    exchange_rate NUMERIC(10, 4) DEFAULT 1.0,
    include_iof BOOLEAN DEFAULT false,
    iof_rate NUMERIC(5, 2) DEFAULT 4.38,
    contingency_percent NUMERIC(5, 2) DEFAULT 10.0, -- Margem de segurança para imprevistos (ex: 10%)
    
    -- Métricas e Parâmetros de Viagem / Projeto
    days_count INTEGER DEFAULT 7,
    people_count INTEGER DEFAULT 1,
    
    -- Metas e Capacidade de Aporte
    monthly_contribution_capacity NUMERIC(12, 2) DEFAULT 500.0,
    current_saved_amount NUMERIC(12, 2) DEFAULT 0.0,
    target_date DATE,
    estimated_completion_date DATE,
    goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.expense_plan_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES public.expense_plans(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    cost_type VARCHAR(20) DEFAULT 'fixo', -- 'fixo', 'diario', 'unitario'
    quantity NUMERIC(10, 2) DEFAULT 1,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
    original_currency VARCHAR(10) DEFAULT 'BRL',
    original_amount NUMERIC(12, 2) DEFAULT 0,
    total_brl NUMERIC(12, 2) NOT NULL DEFAULT 0,
    status VARCHAR(30) DEFAULT 'planejado', -- 'planejado', 'reservado', 'pago'
    payment_method VARCHAR(50) DEFAULT 'dinheiro', -- 'dinheiro', 'cartao_credito', 'debito', 'pontos', 'pix'
    notes TEXT,
    position INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.expense_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_plan_items ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS para expense_plans
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_plans' AND policyname = 'Família visualiza planos de gastos') THEN
        CREATE POLICY "Família visualiza planos de gastos"
            ON public.expense_plans FOR SELECT
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_plans' AND policyname = 'Família cria planos de gastos') THEN
        CREATE POLICY "Família cria planos de gastos"
            ON public.expense_plans FOR INSERT
            WITH CHECK (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_plans' AND policyname = 'Família atualiza planos de gastos') THEN
        CREATE POLICY "Família atualiza planos de gastos"
            ON public.expense_plans FOR UPDATE
            USING (family_id = public.get_my_family_id());
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_plans' AND policyname = 'Família remove planos de gastos') THEN
        CREATE POLICY "Família remove planos de gastos"
            ON public.expense_plans FOR DELETE
            USING (family_id = public.get_my_family_id());
    END IF;
END $$;

-- Políticas de RLS para expense_plan_items
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_plan_items' AND policyname = 'Família visualiza itens dos planos') THEN
        CREATE POLICY "Família visualiza itens dos planos"
            ON public.expense_plan_items FOR SELECT
            USING (plan_id IN (SELECT id FROM public.expense_plans WHERE family_id = public.get_my_family_id()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_plan_items' AND policyname = 'Família cria itens nos planos') THEN
        CREATE POLICY "Família cria itens nos planos"
            ON public.expense_plan_items FOR INSERT
            WITH CHECK (plan_id IN (SELECT id FROM public.expense_plans WHERE family_id = public.get_my_family_id()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_plan_items' AND policyname = 'Família atualiza itens nos planos') THEN
        CREATE POLICY "Família atualiza itens nos planos"
            ON public.expense_plan_items FOR UPDATE
            USING (plan_id IN (SELECT id FROM public.expense_plans WHERE family_id = public.get_my_family_id()));
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'expense_plan_items' AND policyname = 'Família remove itens dos planos') THEN
        CREATE POLICY "Família remove itens dos planos"
            ON public.expense_plan_items FOR DELETE
            USING (plan_id IN (SELECT id FROM public.expense_plans WHERE family_id = public.get_my_family_id()));
    END IF;
END $$;
