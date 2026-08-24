-- 013_add_items_to_benefit_transactions.sql
ALTER TABLE public.benefit_transactions ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
