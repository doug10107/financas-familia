-- Migration 7: Views Agregadas e Função RPC
-- Consultas otimizadas para o dashboard e gráficos

CREATE OR REPLACE VIEW public.monthly_summary AS
SELECT
    t.family_id,
    DATE_TRUNC('month', t.date)::DATE AS month,
    SUM(CASE WHEN t.type = 'receita' AND t.status = 'pago' THEN t.amount ELSE 0 END) AS total_receitas,
    SUM(CASE WHEN t.type = 'despesa' AND t.status = 'pago' THEN t.amount ELSE 0 END) AS total_despesas,
    SUM(CASE WHEN t.type = 'receita' AND t.status = 'pago' THEN t.amount ELSE 0 END)
    - SUM(CASE WHEN t.type = 'despesa' AND t.status = 'pago' THEN t.amount ELSE 0 END) AS saldo,
    COUNT(*) FILTER (WHERE t.status = 'pendente') AS pendentes
FROM public.transactions t
GROUP BY t.family_id, DATE_TRUNC('month', t.date);

CREATE OR REPLACE VIEW public.spending_by_category AS
SELECT
    t.family_id,
    DATE_TRUNC('month', t.date)::DATE AS month,
    c.id AS category_id,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color,
    SUM(t.amount) AS total,
    COUNT(*) AS count
FROM public.transactions t
LEFT JOIN public.categories c ON t.category_id = c.id
WHERE t.type = 'despesa' AND t.status = 'pago'
GROUP BY t.family_id, DATE_TRUNC('month', t.date), c.id, c.name, c.icon, c.color;

CREATE OR REPLACE VIEW public.upcoming_bills AS
SELECT
    t.id,
    t.family_id,
    t.description,
    t.amount,
    t.date,
    t.status,
    c.name AS category_name,
    c.icon AS category_icon,
    c.color AS category_color,
    t.date - CURRENT_DATE AS days_until_due
FROM public.transactions t
LEFT JOIN public.categories c ON t.category_id = c.id
WHERE t.type = 'despesa'
    AND t.status = 'pendente'
    AND t.date >= CURRENT_DATE
    AND t.date <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY t.date ASC;

CREATE OR REPLACE FUNCTION public.get_dashboard_data(p_month DATE DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE)
RETURNS JSONB AS $$
DECLARE
    v_family_id UUID;
    v_result JSONB;
BEGIN
    v_family_id := public.get_my_family_id();

    SELECT jsonb_build_object(
        'summary', (
            SELECT jsonb_build_object(
                'total_receitas', COALESCE(total_receitas, 0),
                'total_despesas', COALESCE(total_despesas, 0),
                'saldo', COALESCE(saldo, 0),
                'pendentes', COALESCE(pendentes, 0)
            )
            FROM public.monthly_summary
            WHERE family_id = v_family_id AND month = p_month
        ),
        'spending_by_category', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'category_name', category_name,
                'category_icon', category_icon,
                'category_color', category_color,
                'total', total
            )), '[]'::jsonb)
            FROM public.spending_by_category
            WHERE family_id = v_family_id AND month = p_month
        ),
        'upcoming_bills', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'id', id,
                'description', description,
                'amount', amount,
                'date', date,
                'days_until_due', days_until_due,
                'category_name', category_name,
                'category_icon', category_icon
            ) ORDER BY date ASC), '[]'::jsonb)
            FROM public.upcoming_bills
            WHERE family_id = v_family_id
            LIMIT 5
        ),
        'monthly_trend', (
            SELECT COALESCE(jsonb_agg(jsonb_build_object(
                'month', month,
                'receitas', total_receitas,
                'despesas', total_despesas,
                'saldo', saldo
            ) ORDER BY month DESC), '[]'::jsonb)
            FROM public.monthly_summary
            WHERE family_id = v_family_id
            AND month >= (p_month - INTERVAL '5 months')
        )
    ) INTO v_result;

    RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
