-- 015_alter_quantity_precision.sql
ALTER TABLE public.shopping_items ALTER COLUMN quantity TYPE NUMERIC(12, 3);
