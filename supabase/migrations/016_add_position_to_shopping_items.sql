-- 016_add_position_to_shopping_items.sql
ALTER TABLE public.shopping_items ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY list_id ORDER BY created_at ASC) - 1 as new_pos
  FROM public.shopping_items
)
UPDATE public.shopping_items si
SET position = ranked.new_pos
FROM ranked
WHERE si.id = ranked.id;
