-- Migration 12: Adicionar tipo de investimento ETFs
-- Insere ETFs para familias existentes e atualiza o trigger de seed para novas familias

-- 1. Inserir ETFs para todas as familias existentes que ainda nao possuem
INSERT INTO public.investment_types (family_id, name, icon, color)
SELECT f.id, 'ETFs', 'candlestick_chart', '#6366f1'
FROM public.families f
WHERE NOT EXISTS (
    SELECT 1 FROM public.investment_types it 
    WHERE it.family_id = f.id AND UPPER(it.name) = 'ETFS'
);

-- 2. Atualizar o trigger de seed para novas familias
CREATE OR REPLACE FUNCTION public.seed_default_investment_types()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.investment_types (family_id, name, icon, color) VALUES
        (NEW.id, 'Renda Fixa', 'lock', '#10b981'),
        (NEW.id, 'Ações', 'show_chart', '#3b82f6'),
        (NEW.id, 'FIIs', 'apartment', '#8b5cf6'),
        (NEW.id, 'ETFs', 'candlestick_chart', '#6366f1'),
        (NEW.id, 'Tesouro Direto', 'account_balance', '#f59e0b'),
        (NEW.id, 'Criptomoedas', 'currency_bitcoin', '#f97316'),
        (NEW.id, 'Poupança', 'savings', '#06b6d4');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
