-- Migration 017: Adicionar suporte a ações, tickers, quantidades, preço unitário e preço médio em investimentos

ALTER TABLE public.investments
ADD COLUMN IF NOT EXISTS ticker TEXT,
ADD COLUMN IF NOT EXISTS quantity NUMERIC(14, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_price NUMERIC(14, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_price NUMERIC(14, 4) DEFAULT 0;

ALTER TABLE public.investment_entries
ADD COLUMN IF NOT EXISTS quantity NUMERIC(14, 4),
ADD COLUMN IF NOT EXISTS unit_price NUMERIC(14, 4),
ADD COLUMN IF NOT EXISTS fees NUMERIC(14, 2) DEFAULT 0;

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
        ),
        quantity = (
            SELECT COALESCE(SUM(
                CASE WHEN type = 'aporte' THEN COALESCE(quantity, 0)
                     WHEN type = 'resgate' THEN -COALESCE(quantity, 0)
                     ELSE 0
                END
            ), 0)
            FROM public.investment_entries
            WHERE investment_id = COALESCE(NEW.investment_id, OLD.investment_id)
        ),
        average_price = (
            SELECT CASE 
                WHEN COALESCE(SUM(CASE WHEN type = 'aporte' THEN COALESCE(quantity, 0) ELSE 0 END), 0) > 0 
                THEN (
                    SELECT COALESCE(SUM(CASE WHEN type = 'aporte' THEN amount ELSE 0 END), 0) / 
                           NULLIF(SUM(CASE WHEN type = 'aporte' THEN COALESCE(quantity, 0) ELSE 0 END), 0)
                )
                ELSE 0
            END
            FROM public.investment_entries
            WHERE investment_id = COALESCE(NEW.investment_id, OLD.investment_id)
        )
    WHERE id = COALESCE(NEW.investment_id, OLD.investment_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
