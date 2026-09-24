-- 019_add_payment_method_to_shopping_lists.sql
ALTER TABLE public.shopping_lists
ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'benefit',
ADD COLUMN IF NOT EXISTS credit_card_id UUID REFERENCES public.credit_cards(id) ON DELETE SET NULL;
