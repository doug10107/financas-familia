-- Migration 020: Adicionar suporte a moedas (BRL e USD) para investimentos internacionais e cotações em dólar

ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL';

ALTER TABLE public.investment_entries
ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL';

-- Inserir ETFs Internacionais se não existir
INSERT INTO public.investment_types (family_id, name, icon, color)
SELECT f.id, 'ETFs Internacionais', 'public', '#0ea5e9'
FROM public.families f
WHERE NOT EXISTS (
    SELECT 1 FROM public.investment_types it 
    WHERE it.family_id = f.id AND (UPPER(it.name) LIKE '%INTERN%')
);
