import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type ShoppingItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  estimatedPrice: number;
  actualPrice: number;
  isChecked: boolean;
};

export type ShoppingList = {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  isCompleted: boolean;
  benefitCardId?: string;
  items: ShoppingItem[];
};

const STORAGE_KEY = 'financas_shopping_lists';

const DEFAULT_LISTS: { title: string; description: string; items: Omit<ShoppingItem, 'id'>[] }[] = [
  {
    title: 'Supermercado',
    description: 'Compras principais para a casa',
    items: [
      { name: 'Arroz 5kg', category: 'Alimentação', quantity: 2, estimatedPrice: 32.00, actualPrice: 29.90, isChecked: true },
      { name: 'Feijão Carioca 1kg', category: 'Alimentação', quantity: 3, estimatedPrice: 9.00, actualPrice: 8.50, isChecked: true },
      { name: 'Leite Integral 1L', category: 'Alimentação', quantity: 12, estimatedPrice: 5.50, actualPrice: 5.20, isChecked: false },
      { name: 'Azeite de Oliva', category: 'Alimentação', quantity: 1, estimatedPrice: 42.00, actualPrice: 39.90, isChecked: false },
      { name: 'Detergente Líquido', category: 'Limpeza', quantity: 4, estimatedPrice: 3.50, actualPrice: 3.20, isChecked: false }
    ]
  }
];

export function useShoppingLists() {
  const [lists, setLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const getFamilyId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = (await supabase
      .from('profiles')
      .select('family_id')
      .eq('id', user.id)
      .single()) as any;

    return { userId: user.id, familyId: profile?.family_id as string | undefined };
  };

  const fetchLists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const authInfo = await getFamilyId();
      if (!authInfo?.familyId) {
        setLoading(false);
        return;
      }

      const { data: dbLists, error: fetchError } = await supabase
        .from('shopping_lists')
        .select(`
          id,
          title,
          description,
          is_completed,
          benefit_card_id,
          created_at,
          shopping_items (
            id,
            name,
            category,
            quantity,
            estimated_price,
            actual_price,
            is_checked,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Check if we need to auto-migrate from localStorage
      if (!dbLists || dbLists.length === 0) {
        try {
          const localSaved = localStorage.getItem(STORAGE_KEY);
          if (localSaved) {
            const parsed = JSON.parse(localSaved);
            if (Array.isArray(parsed) && parsed.length > 0) {
              for (const l of parsed) {
                const { data: newList } = (await supabase
                  .from('shopping_lists')
                  .insert({
                    family_id: authInfo.familyId,
                    user_id: authInfo.userId,
                    title: l.title || 'Minha Lista',
                    description: l.description || '',
                    is_completed: l.isCompleted || false,
                    benefit_card_id: null
                  } as any)
                  .select()
                  .single()) as any;

                if (newList && Array.isArray(l.items) && l.items.length > 0) {
                  const itemsToInsert = l.items.map((i: any) => ({
                    list_id: newList.id,
                    name: i.name,
                    category: i.category || 'Alimentação',
                    quantity: Number(i.quantity) || 1,
                    estimated_price: Number(i.estimatedPrice) || 0,
                    actual_price: Number(i.actualPrice) || 0,
                    is_checked: Boolean(i.isChecked)
                  }));

                  await supabase
                    .from('shopping_items')
                    .insert(itemsToInsert as any);
                }
              }

              // Refetch migrated lists
              const { data: migratedLists } = await supabase
                .from('shopping_lists')
                .select(`
                  id,
                  title,
                  description,
                  is_completed,
                  benefit_card_id,
                  created_at,
                  shopping_items (
                    id,
                    name,
                    category,
                    quantity,
                    estimated_price,
                    actual_price,
                    is_checked,
                    created_at
                  )
                `)
                .order('created_at', { ascending: false });

              if (migratedLists && migratedLists.length > 0) {
                const formatted = mapDbListsToShoppingLists(migratedLists);
                setLists(formatted);
                setLoading(false);
                return;
              }
            }
          }
        } catch (migrationErr) {
          console.warn('Erro ao auto-migrar listas locais:', migrationErr);
        }
      }

      const formatted = mapDbListsToShoppingLists(dbLists || []);
      setLists(formatted);
    } catch (err: any) {
      console.error('Erro ao buscar listas de compras:', err);
      setError(err.message || 'Erro ao carregar listas de compras');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  function mapDbListsToShoppingLists(dbLists: any[]): ShoppingList[] {
    return dbLists.map((l: any) => {
      const items: ShoppingItem[] = (l.shopping_items || [])
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((i: any) => ({
          id: i.id,
          name: i.name,
          category: i.category || 'Alimentação',
          quantity: Number(i.quantity) || 1,
          estimatedPrice: Number(i.estimated_price) || 0,
          actualPrice: Number(i.actual_price) || 0,
          isChecked: Boolean(i.is_checked)
        }));

      return {
        id: l.id,
        title: l.title,
        description: l.description || '',
        createdAt: l.created_at ? l.created_at.split('T')[0] : new Date().toISOString().split('T')[0],
        isCompleted: Boolean(l.is_completed),
        benefitCardId: l.benefit_card_id || undefined,
        items
      };
    });
  }

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const createList = async (title: string, description?: string, benefitCardId?: string) => {
    try {
      const authInfo = await getFamilyId();
      if (!authInfo?.familyId) return null;

      const { data, error } = (await supabase
        .from('shopping_lists')
        .insert({
          family_id: authInfo.familyId,
          user_id: authInfo.userId,
          title,
          description: description || '',
          is_completed: false,
          benefit_card_id: benefitCardId || null
        } as any)
        .select()
        .single()) as any;

      if (error) throw error;

      await fetchLists();
      return data?.id;
    } catch (err: any) {
      console.error('Erro ao criar lista de compras:', err);
      setError(err.message);
      return null;
    }
  };

  const addItem = async (listId: string, item: Omit<ShoppingItem, 'id' | 'isChecked'>) => {
    try {
      const { data, error } = (await supabase
        .from('shopping_items')
        .insert({
          list_id: listId,
          name: item.name,
          category: item.category || 'Alimentação',
          quantity: item.quantity,
          estimated_price: item.estimatedPrice,
          actual_price: item.actualPrice,
          is_checked: false
        } as any)
        .select()
        .single()) as any;

      if (error) throw error;

      // Optimistic update
      if (data) {
        const newItem: ShoppingItem = {
          id: data.id,
          name: data.name,
          category: data.category,
          quantity: Number(data.quantity),
          estimatedPrice: Number(data.estimated_price),
          actualPrice: Number(data.actual_price),
          isChecked: Boolean(data.is_checked)
        };

        setLists(prev => prev.map(l => {
          if (l.id === listId) {
            return { ...l, items: [...l.items, newItem] };
          }
          return l;
        }));
      }

      return true;
    } catch (err: any) {
      console.error('Erro ao adicionar item na lista:', err);
      setError(err.message);
      return false;
    }
  };

  const toggleItem = async (listId: string, itemId: string) => {
    const list = lists.find(l => l.id === listId);
    const item = list?.items.find(i => i.id === itemId);
    if (!item) return;

    const newChecked = !item.isChecked;

    // Optimistic update
    setLists(prev => prev.map(l => {
      if (l.id === listId) {
        return {
          ...l,
          items: l.items.map(i => i.id === itemId ? { ...i, isChecked: newChecked } : i)
        };
      }
      return l;
    }));

    try {
      const { error } = await (supabase
        .from('shopping_items') as any)
        .update({ is_checked: newChecked })
        .eq('id', itemId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao alternar item:', err);
      await fetchLists(); // Revert on failure
    }
  };

  const updateItemPrice = async (listId: string, itemId: string, actualPrice: number) => {
    // Optimistic update
    setLists(prev => prev.map(l => {
      if (l.id === listId) {
        return {
          ...l,
          items: l.items.map(i => i.id === itemId ? { ...i, actualPrice } : i)
        };
      }
      return l;
    }));

    try {
      const { error } = await (supabase
        .from('shopping_items') as any)
        .update({ actual_price: actualPrice })
        .eq('id', itemId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao atualizar preço do item:', err);
      await fetchLists();
    }
  };

  const deleteItem = async (listId: string, itemId: string) => {
    // Optimistic update
    setLists(prev => prev.map(l => {
      if (l.id === listId) {
        return { ...l, items: l.items.filter(i => i.id !== itemId) };
      }
      return l;
    }));

    try {
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao deletar item:', err);
      await fetchLists();
    }
  };

  const deleteList = async (listId: string) => {
    setLists(prev => prev.filter(l => l.id !== listId));

    try {
      const { error } = await supabase
        .from('shopping_lists')
        .delete()
        .eq('id', listId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao excluir lista:', err);
      await fetchLists();
    }
  };

  const updateList = async (listId: string, updatedData: Partial<Omit<ShoppingList, 'id' | 'items'>>) => {
    setLists(prev => prev.map(l => {
      if (l.id === listId) {
        return { ...l, ...updatedData };
      }
      return l;
    }));

    try {
      const payload: any = {};
      if (updatedData.title !== undefined) payload.title = updatedData.title;
      if (updatedData.description !== undefined) payload.description = updatedData.description;
      if (updatedData.benefitCardId !== undefined) payload.benefit_card_id = updatedData.benefitCardId;
      if (updatedData.isCompleted !== undefined) payload.is_completed = updatedData.isCompleted;

      const { error } = await (supabase
        .from('shopping_lists') as any)
        .update(payload)
        .eq('id', listId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao atualizar lista:', err);
      await fetchLists();
    }
  };

  const completeList = async (listId: string) => {
    await updateList(listId, { isCompleted: true });
  };

  return {
    lists,
    loading,
    error,
    refreshData: fetchLists,
    createList,
    updateList,
    addItem,
    toggleItem,
    updateItemPrice,
    deleteItem,
    deleteList,
    completeList
  };
}
