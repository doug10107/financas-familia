-- Migration 018: Adicionar tipo de investimento Previdência Privada e campos de plano/tributação
-- Insere Previdência Privada para famílias existentes e atualiza o trigger de seed para novas famílias

-- 1. Adicionar colunas opcionais para planos de previdência
ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS plan_type TEXT,
ADD COLUMN IF NOT EXISTS tax_regime TEXT;

-- 2. Inserir Previdência Privada para todas as famílias existentes que ainda não possuem
INSERT INTO public.investment_types (family_id, name, icon, color)
SELECT f.id, 'Previdência Privada', 'shield', '#059669'
FROM public.families f
WHERE NOT EXISTS (
    SELECT 1 FROM public.investment_types it 
    WHERE it.family_id = f.id AND (UPPER(it.name) LIKE '%PREVID%')
);

-- 3. Atualizar o trigger de seed para novas famílias
CREATE OR REPLACE FUNCTION public.seed_default_investment_types()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.investment_types (family_id, name, icon, color) VALUES
        (NEW.id, 'Renda Fixa', 'lock', '#10b981'),
        (NEW.id, 'Ações', 'show_chart', '#3b82f6'),
        (NEW.id, 'FIIs', 'apartment', '#8b5cf6'),
        (NEW.id, 'ETFs', 'candlestick_chart', '#6366f1'),
        (NEW.id, 'Previdência Privada', 'shield', '#059669'),
        (NEW.id, 'Tesouro Direto', 'account_balance', '#f59e0b'),
        (NEW.id, 'Criptomoedas', 'currency_bitcoin', '#f97316'),
        (NEW.id, 'Poupança', 'savings', '#06b6d4');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
