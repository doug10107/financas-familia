-- Migration 025: Suporte a Estornos e Créditos de Fatura de Cartão de Crédito
-- Permite vincular estornos a compras originais e deduzir automaticamente das faturas.

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS is_refund BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS refund_for_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_refund_for_id ON public.transactions(refund_for_id);
CREATE INDEX IF NOT EXISTS idx_transactions_is_refund ON public.transactions(is_refund) WHERE is_refund = true;
