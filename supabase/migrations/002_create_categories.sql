-- Migration 2: Categorias de Transações
-- Categorias padrão são criadas automaticamente ao criar uma família

CREATE TABLE public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'category',
    color TEXT NOT NULL DEFAULT '#6c7a71',
    type TEXT NOT NULL CHECK (type IN ('receita', 'despesa', 'ambos')),
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_family ON public.categories(family_id);

CREATE OR REPLACE FUNCTION public.seed_default_categories()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.categories (family_id, name, icon, color, type, is_default) VALUES
        (NEW.id, 'Salário', 'payments', '#10b981', 'receita', true),
        (NEW.id, 'Freelance', 'work', '#059669', 'receita', true),
        (NEW.id, 'Investimentos', 'trending_up', '#0058be', 'receita', true),
        (NEW.id, 'Outros (Receita)', 'add_circle', '#6c7a71', 'receita', true),
        (NEW.id, 'Alimentação', 'restaurant', '#f59e0b', 'despesa', true),
        (NEW.id, 'Moradia', 'home', '#8b5cf6', 'despesa', true),
        (NEW.id, 'Transporte', 'directions_car', '#3b82f6', 'despesa', true),
        (NEW.id, 'Saúde', 'health_and_safety', '#ef4444', 'despesa', true),
        (NEW.id, 'Educação', 'school', '#06b6d4', 'despesa', true),
        (NEW.id, 'Lazer', 'sports_esports', '#ec4899', 'despesa', true),
        (NEW.id, 'Vestuário', 'checkroom', '#f97316', 'despesa', true),
        (NEW.id, 'Contas Fixas', 'electric_bolt', '#dc2626', 'despesa', true),
        (NEW.id, 'Assinaturas', 'subscriptions', '#7c3aed', 'despesa', true),
        (NEW.id, 'Outros (Despesa)', 'more_horiz', '#6c7a71', 'despesa', true);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_family_created_seed_categories
    AFTER INSERT ON public.families
    FOR EACH ROW EXECUTE FUNCTION public.seed_default_categories();
