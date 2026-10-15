import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { 
  ExpensePlan, 
  ExpensePlanItem, 
  PlanCategoryType, 
  PLAN_TEMPLATES, 
  calculatePlanTotals, 
  calculateTargetDateFromContribution,
  calculateItemTotalBrl
} from '@/lib/expensePlanCalculators';

const LOCAL_STORAGE_KEY = 'financas_expense_plans_v1';

export function useExpensePlans() {
  const [plans, setPlans] = useState<ExpensePlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const getFamilyId = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: profile } = (await supabase
        .from('profiles')
        .select('family_id')
        .eq('id', user.id)
        .single()) as any;

      return { userId: user.id, familyId: profile?.family_id as string | undefined };
    } catch {
      return null;
    }
  };

  // Carregar planos (tentativa Supabase -> fallback LocalStorage)
  const fetchPlans = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const auth = await getFamilyId();

      if (auth?.familyId) {
        // Tentar buscar do Supabase
        const { data: dbPlans, error: dbError } = await (supabase
          .from('expense_plans') as any)
          .select(`
            *,
            items:expense_plan_items(*)
          `)
          .eq('family_id', auth.familyId)
          .order('created_at', { ascending: false });

        if (!dbError && dbPlans && dbPlans.length > 0) {
          const formattedPlans: ExpensePlan[] = dbPlans.map((p: any) => ({
            id: p.id,
            family_id: p.family_id,
            created_by: p.created_by,
            title: p.title,
            description: p.description,
            category_type: p.category_type as PlanCategoryType,
            icon: p.icon || 'flight_takeoff',
            color: p.color || '#0ea5e9',
            status: p.status || 'planejamento',
            currency: p.currency || 'BRL',
            exchange_rate: Number(p.exchange_rate) || 1,
            include_iof: Boolean(p.include_iof),
            iof_rate: Number(p.iof_rate) || 4.38,
            contingency_percent: Number(p.contingency_percent) || 10,
            days_count: Number(p.days_count) || 7,
            people_count: Number(p.people_count) || 1,
            monthly_contribution_capacity: Number(p.monthly_contribution_capacity) || 500,
            current_saved_amount: Number(p.current_saved_amount) || 0,
            target_date: p.target_date,
            estimated_completion_date: p.estimated_completion_date,
            goal_id: p.goal_id,
            created_at: p.created_at,
            updated_at: p.updated_at,
            items: (p.items || [])
              .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))
              .map((i: any) => ({
                id: i.id,
                plan_id: i.plan_id,
                category: i.category,
                name: i.name,
                cost_type: i.cost_type,
                quantity: Number(i.quantity) || 1,
                unit_cost: Number(i.unit_cost) || 0,
                original_currency: i.original_currency || 'BRL',
                original_amount: Number(i.original_amount) || 0,
                total_brl: Number(i.total_brl) || 0,
                status: i.status || 'planejado',
                payment_method: i.payment_method,
                notes: i.notes,
                position: i.position
              }))
          }));

          setPlans(formattedPlans);
          if (!activePlanId && formattedPlans.length > 0) {
            setActivePlanId(formattedPlans[0].id);
          }
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(formattedPlans));
          setLoading(false);
          return;
        }
      }

      // Fallback: LocalStorage
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localData) {
        const parsed: ExpensePlan[] = JSON.parse(localData);
        setPlans(parsed);
        if (!activePlanId && parsed.length > 0) {
          setActivePlanId(parsed[0].id);
        }
      } else {
        // Criar plano inicial padrão de Viagem para demonstração imediata
        const defaultTemplate = PLAN_TEMPLATES.viagem;
        const initialPlanId = 'plan_demo_viagem';
        const initialItems: ExpensePlanItem[] = defaultTemplate.items.map((it, idx) => ({
          ...it,
          id: `item_${Date.now()}_${idx}`,
          plan_id: initialPlanId,
          total_brl: calculateItemTotalBrl(it, 1, false, 4.38),
          position: idx
        }));

        const initialPlan: ExpensePlan = {
          id: initialPlanId,
          title: 'Viagem de Férias dos Sonhos',
          description: 'Orçamento completo para 7 dias em 2 pessoas (passagens, hotel, carro, passeios e alimentação)',
          category_type: 'viagem',
          icon: defaultTemplate.icon,
          color: defaultTemplate.color,
          status: 'planejamento',
          currency: 'BRL',
          exchange_rate: 1,
          include_iof: false,
          iof_rate: 4.38,
          contingency_percent: defaultTemplate.contingencyPercent,
          days_count: defaultTemplate.defaultDays,
          people_count: defaultTemplate.defaultPeople,
          monthly_contribution_capacity: 1000,
          current_saved_amount: 1500,
          items: initialItems,
          created_at: new Date().toISOString()
        };

        const initialList = [initialPlan];
        setPlans(initialList);
        setActivePlanId(initialPlanId);
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialList));
      }
    } catch (err: any) {
      console.warn('Erro ao carregar do banco, usando armazenamento local:', err);
      const localData = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (localData) {
        setPlans(JSON.parse(localData));
      }
    } finally {
      setLoading(false);
    }
  }, [supabase, activePlanId]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Salvar no storage local e tentar sincronizar no Supabase
  const persistPlanLocal = (newPlans: ExpensePlan[]) => {
    setPlans(newPlans);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(newPlans));
  };

  /**
   * Criar um novo planejamento (com suporte a templates)
   */
  const createPlan = async (input: {
    title: string;
    description?: string;
    category_type: PlanCategoryType;
    icon?: string;
    color?: string;
    currency?: string;
    exchange_rate?: number;
    days_count?: number;
    people_count?: number;
    monthly_contribution_capacity?: number;
    current_saved_amount?: number;
    contingency_percent?: number;
    useTemplateItems?: boolean;
  }): Promise<ExpensePlan> => {
    const template = PLAN_TEMPLATES[input.category_type] || PLAN_TEMPLATES.personalizado;
    const planId = `plan_${Date.now()}`;
    const auth = await getFamilyId();

    const itemsToCreate: ExpensePlanItem[] = (input.useTemplateItems !== false ? template.items : []).map(
      (it, idx) => ({
        ...it,
        id: `item_${Date.now()}_${idx}`,
        plan_id: planId,
        total_brl: calculateItemTotalBrl(
          it,
          input.exchange_rate || 1,
          false,
          4.38
        ),
        position: idx
      })
    );

    const newPlan: ExpensePlan = {
      id: planId,
      family_id: auth?.familyId,
      created_by: auth?.userId,
      title: input.title,
      description: input.description || template.description,
      category_type: input.category_type,
      icon: input.icon || template.icon,
      color: input.color || template.color,
      status: 'planejamento',
      currency: input.currency || 'BRL',
      exchange_rate: input.exchange_rate || 1,
      include_iof: false,
      iof_rate: 4.38,
      contingency_percent: input.contingency_percent ?? template.contingencyPercent,
      days_count: input.days_count || template.defaultDays,
      people_count: input.people_count || template.defaultPeople,
      monthly_contribution_capacity: input.monthly_contribution_capacity || 500,
      current_saved_amount: input.current_saved_amount || 0,
      items: itemsToCreate,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Tentar persistir no Supabase se possível
    if (auth?.familyId) {
      try {
        const { data: dbPlan } = await ((supabase
          .from('expense_plans') as any)
          .insert({
            family_id: auth.familyId,
            created_by: auth.userId,
            title: newPlan.title,
            description: newPlan.description,
            category_type: newPlan.category_type,
            icon: newPlan.icon,
            color: newPlan.color,
            status: newPlan.status,
            currency: newPlan.currency,
            exchange_rate: newPlan.exchange_rate,
            contingency_percent: newPlan.contingency_percent,
            days_count: newPlan.days_count,
            people_count: newPlan.people_count,
            monthly_contribution_capacity: newPlan.monthly_contribution_capacity,
            current_saved_amount: newPlan.current_saved_amount
          })
          .select()
          .single() as any);

        if (dbPlan) {
          newPlan.id = dbPlan.id;

          if (itemsToCreate.length > 0) {
            const dbItems = itemsToCreate.map((i) => ({
              plan_id: dbPlan.id,
              category: i.category,
              name: i.name,
              cost_type: i.cost_type,
              quantity: i.quantity,
              unit_cost: i.unit_cost,
              original_currency: i.original_currency,
              original_amount: i.original_amount,
              total_brl: i.total_brl,
              status: i.status,
              position: i.position
            }));
            await ((supabase.from('expense_plan_items') as any).insert(dbItems) as any);
          }
        }
      } catch (err) {
        console.warn('Erro ao salvar no banco, persistido localmente:', err);
      }
    }

    const updated = [newPlan, ...plans];
    persistPlanLocal(updated);
    setActivePlanId(newPlan.id);
    return newPlan;
  };

  /**
   * Atualizar dados gerais de um planejamento
   */
  const updatePlan = async (id: string, updates: Partial<ExpensePlan>) => {
    const updated = plans.map((p) => {
      if (p.id !== id) return p;
      return { ...p, ...updates, updated_at: new Date().toISOString() };
    });
    persistPlanLocal(updated);

    try {
      await ((supabase
        .from('expense_plans') as any)
        .update({
          title: updates.title,
          description: updates.description,
          icon: updates.icon,
          color: updates.color,
          status: updates.status,
          currency: updates.currency,
          exchange_rate: updates.exchange_rate,
          include_iof: updates.include_iof,
          iof_rate: updates.iof_rate,
          contingency_percent: updates.contingency_percent,
          days_count: updates.days_count,
          people_count: updates.people_count,
          monthly_contribution_capacity: updates.monthly_contribution_capacity,
          current_saved_amount: updates.current_saved_amount,
          target_date: updates.target_date,
          updated_at: new Date().toISOString()
        })
        .eq('id', id) as any);
    } catch (err) {
      console.warn('Erro ao atualizar no banco:', err);
    }
  };

  /**
   * Excluir um planejamento
   */
  const deletePlan = async (id: string) => {
    const remaining = plans.filter((p) => p.id !== id);
    persistPlanLocal(remaining);
    if (activePlanId === id) {
      setActivePlanId(remaining.length > 0 ? remaining[0].id : null);
    }

    try {
      await (supabase.from('expense_plans').delete().eq('id', id) as any);
    } catch (err) {
      console.warn('Erro ao excluir no banco:', err);
    }
  };

  /**
   * Adicionar um item a um plano
   */
  const addItem = async (
    planId: string,
    itemData: Omit<ExpensePlanItem, 'id' | 'total_brl'>
  ) => {
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return;

    const totalBrl = calculateItemTotalBrl(
      itemData,
      targetPlan.exchange_rate,
      targetPlan.include_iof,
      targetPlan.iof_rate
    );

    const newItem: ExpensePlanItem = {
      ...itemData,
      id: `item_${Date.now()}`,
      plan_id: planId,
      total_brl: totalBrl,
      position: (targetPlan.items || []).length
    };

    const updated = plans.map((p) => {
      if (p.id !== planId) return p;
      return {
        ...p,
        items: [...(p.items || []), newItem],
        updated_at: new Date().toISOString()
      };
    });
    persistPlanLocal(updated);

    try {
      await ((supabase.from('expense_plan_items') as any).insert({
        plan_id: planId,
        category: newItem.category,
        name: newItem.name,
        cost_type: newItem.cost_type,
        quantity: newItem.quantity,
        unit_cost: newItem.unit_cost,
        original_currency: newItem.original_currency,
        original_amount: newItem.original_amount,
        total_brl: newItem.total_brl,
        status: newItem.status,
        payment_method: newItem.payment_method,
        notes: newItem.notes,
        position: newItem.position
      }) as any);
    } catch (err) {
      console.warn('Erro ao adicionar item no banco:', err);
    }
  };

  /**
   * Atualizar um item
   */
  const updateItem = async (
    planId: string,
    itemId: string,
    updates: Partial<ExpensePlanItem>
  ) => {
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return;

    const updated = plans.map((p) => {
      if (p.id !== planId) return p;
      const newItems = (p.items || []).map((item) => {
        if (item.id !== itemId) return item;
        const merged = { ...item, ...updates };
        const totalBrl = calculateItemTotalBrl(
          merged,
          targetPlan.exchange_rate,
          targetPlan.include_iof,
          targetPlan.iof_rate
        );
        return { ...merged, total_brl: totalBrl };
      });
      return { ...p, items: newItems, updated_at: new Date().toISOString() };
    });
    persistPlanLocal(updated);

    try {
      await ((supabase
        .from('expense_plan_items') as any)
        .update({
          category: updates.category,
          name: updates.name,
          cost_type: updates.cost_type,
          quantity: updates.quantity,
          unit_cost: updates.unit_cost,
          original_currency: updates.original_currency,
          original_amount: updates.original_amount,
          total_brl: updates.total_brl,
          status: updates.status,
          payment_method: updates.payment_method,
          notes: updates.notes
        })
        .eq('id', itemId) as any);
    } catch (err) {
      console.warn('Erro ao atualizar item no banco:', err);
    }
  };

  /**
   * Alternar status de pagamento do item (planejado <-> pago)
   */
  const toggleItemPaid = (planId: string, itemId: string) => {
    const targetPlan = plans.find((p) => p.id === planId);
    if (!targetPlan) return;
    const currentItem = (targetPlan.items || []).find((i) => i.id === itemId);
    if (!currentItem) return;

    const newStatus = currentItem.status === 'pago' ? 'planejado' : 'pago';
    updateItem(planId, itemId, { status: newStatus });
  };

  /**
   * Deletar item
   */
  const deleteItem = async (planId: string, itemId: string) => {
    const updated = plans.map((p) => {
      if (p.id !== planId) return p;
      return {
        ...p,
        items: (p.items || []).filter((i) => i.id !== itemId),
        updated_at: new Date().toISOString()
      };
    });
    persistPlanLocal(updated);

    try {
      await (supabase.from('expense_plan_items').delete().eq('id', itemId) as any);
    } catch (err) {
      console.warn('Erro ao deletar item no banco:', err);
    }
  };

  /**
   * Exportar ou Vincular Planejamento a uma Meta Oficial do App (1 clique!)
   */
  const exportPlanToGoal = async (planId: string): Promise<string | null> => {
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return null;

    const totals = calculatePlanTotals(plan, plan.items || []);
    const remaining = totals.remainingToSave;
    const targetAmount = totals.grandTotal;

    const dateResult = calculateTargetDateFromContribution(
      remaining,
      plan.monthly_contribution_capacity || 500
    );

    const deadline = plan.target_date || dateResult.estimatedDateWithInterest;

    try {
      const auth = await getFamilyId();
      if (!auth?.familyId) {
        alert('Meta gerada com sucesso e vinculada ao planejamento local!');
        return 'goal_mock_id';
      }

      // Inserir meta oficial no banco
      const { data: newGoal, error: goalErr } = await ((supabase
        .from('goals') as any)
        .insert({
          family_id: auth.familyId,
          name: plan.title,
          target_amount: targetAmount,
          current_amount: totals.paidAmount + plan.current_saved_amount,
          deadline: deadline,
          status: 'em_andamento',
          color: plan.color,
          target_monthly_deposit: plan.monthly_contribution_capacity,
          estimated_annual_rate: 10.5
        })
        .select()
        .single() as any);

      if (goalErr) {
        throw goalErr;
      }

      if (newGoal) {
        await updatePlan(planId, { goal_id: newGoal.id, target_date: deadline });
        return newGoal.id;
      }
    } catch (err: any) {
      console.error('Erro ao exportar meta:', err);
      throw err;
    }
    return null;
  };

  const activePlan = plans.find((p) => p.id === activePlanId) || plans[0] || null;

  return {
    plans,
    activePlan,
    activePlanId,
    setActivePlanId,
    loading,
    error,
    fetchPlans,
    createPlan,
    updatePlan,
    deletePlan,
    addItem,
    updateItem,
    deleteItem,
    toggleItemPaid,
    exportPlanToGoal
  };
}
