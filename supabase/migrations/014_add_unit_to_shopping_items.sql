-- 014_add_unit_to_shopping_items.sql
ALTER TABLE public.shopping_items ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'un';
