-- Migration 21: Metas Inteligentes e Integração com Investimentos
-- Adiciona suporte para taxa estimada, aporte mensal planejado e vínculo com ativos

ALTER TABLE public.goals
ADD COLUMN IF NOT EXISTS target_monthly_deposit NUMERIC(12, 2),
ADD COLUMN IF NOT EXISTS estimated_annual_rate NUMERIC(6, 2) DEFAULT 10.5,
ADD COLUMN IF NOT EXISTS investment_id UUID REFERENCES public.investments(id) ON DELETE SET NULL;

ALTER TABLE public.goal_contributions
ADD COLUMN IF NOT EXISTS investment_id UUID REFERENCES public.investments(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.goal_investments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
    investment_id UUID NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(goal_id, investment_id)
);

ALTER TABLE public.goal_investments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'goal_investments' AND policyname = 'Membros veem investimentos vinculados as metas'
    ) THEN
        CREATE POLICY "Membros veem investimentos vinculados as metas"
            ON public.goal_investments FOR SELECT
            USING (goal_id IN (SELECT id FROM public.goals WHERE family_id = public.get_my_family_id()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'goal_investments' AND policyname = 'Membros criam vinculos de metas e investimentos'
    ) THEN
        CREATE POLICY "Membros criam vinculos de metas e investimentos"
            ON public.goal_investments FOR INSERT
            WITH CHECK (goal_id IN (SELECT id FROM public.goals WHERE family_id = public.get_my_family_id()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'goal_investments' AND policyname = 'Membros deletam vinculos de metas e investimentos'
    ) THEN
        CREATE POLICY "Membros deletam vinculos de metas e investimentos"
            ON public.goal_investments FOR DELETE
            USING (goal_id IN (SELECT id FROM public.goals WHERE family_id = public.get_my_family_id()));
    END IF;
END $$;
