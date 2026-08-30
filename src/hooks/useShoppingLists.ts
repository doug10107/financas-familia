import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type ShoppingItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string; // 'un' | 'kg' | 'g' | 'L' | 'ml' | 'pct' | 'cx'
  estimatedPrice: number;
  actualPrice: number;
  isChecked: boolean;
  position?: number;
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
      { name: 'Arroz 5kg', category: 'Alimentação', quantity: 2, unit: 'un', estimatedPrice: 32.00, actualPrice: 29.90, isChecked: true, position: 0 },
      { name: 'Feijão Carioca 1kg', category: 'Alimentação', quantity: 3, unit: 'un', estimatedPrice: 9.00, actualPrice: 8.50, isChecked: true, position: 1 },
      { name: 'Banana Prata', category: 'Hortifruti', quantity: 1.5, unit: 'kg', estimatedPrice: 7.90, actualPrice: 7.50, isChecked: false, position: 2 },
      { name: 'Alcatra Bife', category: 'Açougue', quantity: 1.2, unit: 'kg', estimatedPrice: 45.00, actualPrice: 42.90, isChecked: false, position: 3 },
      { name: 'Leite Integral 1L', category: 'Alimentação', quantity: 12, unit: 'L', estimatedPrice: 5.50, actualPrice: 5.20, isChecked: false, position: 4 },
      { name: 'Azeite de Oliva', category: 'Alimentação', quantity: 1, unit: 'un', estimatedPrice: 42.00, actualPrice: 39.90, isChecked: false, position: 5 },
      { name: 'Detergente Líquido', category: 'Limpeza', quantity: 4, unit: 'un', estimatedPrice: 3.50, actualPrice: 3.20, isChecked: false, position: 6 }
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

  const mapDbListsToShoppingLists = useCallback((dbLists: any[]): ShoppingList[] => {
    return dbLists.map((l: any) => {
      const items: ShoppingItem[] = (l.shopping_items || [])
        .sort((a: any, b: any) => {
          const posA = a.position !== undefined && a.position !== null ? Number(a.position) : 0;
          const posB = b.position !== undefined && b.position !== null ? Number(b.position) : 0;
          if (posA !== posB) return posA - posB;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        })
        .map((i: any, index: number) => ({
          id: i.id,
          name: i.name,
          category: i.category || 'Alimentação',
          quantity: Number(i.quantity) || 1,
          unit: i.unit || 'un',
          estimatedPrice: Number(i.estimated_price) || 0,
          actualPrice: Number(i.actual_price) || 0,
          isChecked: Boolean(i.is_checked),
          position: i.position !== undefined && i.position !== null ? Number(i.position) : index
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
  }, []);

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
            unit,
            estimated_price,
            actual_price,
            is_checked,
            position,
            created_at
          )
        `)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Check if we need to auto-migrate from localStorage (run once and clear)
      if (!dbLists || dbLists.length === 0) {
        try {
          const migrationDoneKey = 'financas_shopping_lists_migrated_done';
          const alreadyMigrated = typeof window !== 'undefined' ? localStorage.getItem(migrationDoneKey) : 'true';
          const localSaved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;

          if (!alreadyMigrated && localSaved) {
            localStorage.setItem(migrationDoneKey, 'true');
            localStorage.removeItem(STORAGE_KEY);
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
                    unit: i.unit || 'un',
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
                    unit,
                    estimated_price,
                    actual_price,
                    is_checked,
                    position,
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
          } else if (typeof window !== 'undefined') {
            // Ensure old localStorage is cleared so it doesn't resurrect deleted lists
            localStorage.removeItem(STORAGE_KEY);
            localStorage.setItem(migrationDoneKey, 'true');
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
  }, [supabase, mapDbListsToShoppingLists]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const isValidUUID = (id?: string | null) => Boolean(id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id));

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
          benefit_card_id: isValidUUID(benefitCardId) ? benefitCardId : null
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

  const createListWithItems = async (
    title: string,
    description?: string,
    benefitCardId?: string,
    items?: Omit<ShoppingItem, 'id' | 'isChecked'>[]
  ) => {
    try {
      const listId = await createList(title, description, benefitCardId);
      if (!listId) return null;

      if (items && items.length > 0) {
        await addMultipleItems(listId, items);
      }

      await fetchLists();
      return listId;
    } catch (err: any) {
      console.error('Erro ao criar lista com itens:', err);
      setError(err.message);
      return null;
    }
  };

  const addItem = async (listId: string, item: Omit<ShoppingItem, 'id' | 'isChecked'>) => {
    try {
      const currentList = lists.find(l => l.id === listId);
      const maxPos = currentList && currentList.items.length > 0
        ? Math.max(...currentList.items.map(i => i.position ?? 0))
        : -1;
      const nextPos = item.position !== undefined ? item.position : (maxPos + 1);

      const { data, error } = (await supabase
        .from('shopping_items')
        .insert({
          list_id: listId,
          name: item.name,
          category: item.category || 'Alimentação',
          quantity: item.quantity,
          unit: item.unit || 'un',
          estimated_price: item.estimatedPrice,
          actual_price: item.actualPrice,
          is_checked: false,
          position: nextPos
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
          unit: data.unit || 'un',
          estimatedPrice: Number(data.estimated_price),
          actualPrice: Number(data.actual_price),
          isChecked: Boolean(data.is_checked),
          position: data.position !== undefined && data.position !== null ? Number(data.position) : nextPos
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

  const addMultipleItems = async (listId: string, newItems: Omit<ShoppingItem, 'id' | 'isChecked'>[]) => {
    if (!newItems || newItems.length === 0) return true;

    try {
      const currentList = lists.find(l => l.id === listId);
      const startPos = currentList && currentList.items.length > 0
        ? Math.max(...currentList.items.map(i => i.position ?? 0)) + 1
        : 0;

      const itemsToInsert = newItems.map((item, idx) => ({
        list_id: listId,
        name: item.name,
        category: item.category || 'Alimentação',
        quantity: Number(item.quantity) || 1,
        unit: item.unit || 'un',
        estimated_price: Number(item.estimatedPrice) || 0,
        actual_price: Number(item.actualPrice) || 0,
        is_checked: false,
        position: item.position !== undefined ? item.position : (startPos + idx)
      }));

      const { data, error } = await supabase
        .from('shopping_items')
        .insert(itemsToInsert as any)
        .select();

      if (error) throw error;

      if (data && Array.isArray(data)) {
        const formattedItems: ShoppingItem[] = data.map((d: any, idx: number) => ({
          id: d.id,
          name: d.name,
          category: d.category,
          quantity: Number(d.quantity),
          unit: d.unit || 'un',
          estimatedPrice: Number(d.estimated_price),
          actualPrice: Number(d.actual_price),
          isChecked: Boolean(d.is_checked),
          position: d.position !== undefined && d.position !== null ? Number(d.position) : (startPos + idx)
        }));

        setLists(prev => prev.map(l => {
          if (l.id === listId) {
            return { ...l, items: [...l.items, ...formattedItems] };
          }
          return l;
        }));
      }

      return true;
    } catch (err: any) {
      console.error('Erro ao adicionar múltiplos itens na lista:', err);
      setError(err.message);
      return false;
    }
  };

  const moveItem = async (listId: string, itemId: string, direction: 'up' | 'down') => {
    const list = lists.find(l => l.id === listId);
    if (!list) return;

    const currentIndex = list.items.findIndex(i => i.id === itemId);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= list.items.length) return;

    const newItems = [...list.items];
    const [movedItem] = newItems.splice(currentIndex, 1);
    newItems.splice(targetIndex, 0, movedItem);

    // Re-assign consecutive positions
    const reindexedItems = newItems.map((item, idx) => ({
      ...item,
      position: idx
    }));

    // Optimistic update
    setLists(prev => prev.map(l => {
      if (l.id === listId) {
        return { ...l, items: reindexedItems };
      }
      return l;
    }));

    try {
      const item1 = reindexedItems[currentIndex];
      const item2 = reindexedItems[targetIndex];

      await Promise.all([
        (supabase.from('shopping_items') as any).update({ position: item1.position }).eq('id', item1.id),
        (supabase.from('shopping_items') as any).update({ position: item2.position }).eq('id', item2.id)
      ]);
    } catch (err: any) {
      console.error('Erro ao reordenar item:', err);
      await fetchLists();
    }
  };

  const reorderListByAisle = async (listId: string) => {
    const AISLE_ORDER = [
      'Hortifruti',
      'Padaria',
      'Açougue',
      'Alimentação',
      'Bebidas',
      'Limpeza',
      'Higiene',
      'Outros'
    ];

    const list = lists.find(l => l.id === listId);
    if (!list) return;

    const sortedItems = [...list.items].sort((a, b) => {
      const catIndexA = AISLE_ORDER.indexOf(a.category);
      const catIndexB = AISLE_ORDER.indexOf(b.category);
      const orderA = catIndexA === -1 ? 999 : catIndexA;
      const orderB = catIndexB === -1 ? 999 : catIndexB;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, 'pt-BR');
    });

    const reindexedItems = sortedItems.map((item, idx) => ({
      ...item,
      position: idx
    }));

    // Optimistic update
    setLists(prev => prev.map(l => {
      if (l.id === listId) {
        return { ...l, items: reindexedItems };
      }
      return l;
    }));

    try {
      await Promise.all(
        reindexedItems.map(item =>
          (supabase.from('shopping_items') as any)
            .update({ position: item.position })
            .eq('id', item.id)
        )
      );
    } catch (err: any) {
      console.error('Erro ao ordenar por corredor:', err);
      await fetchLists();
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

  const toggleAllItems = async (listId: string, isChecked: boolean) => {
    const list = lists.find(l => l.id === listId);
    if (!list || list.items.length === 0) return;

    // Optimistic update
    setLists(prev => prev.map(l => {
      if (l.id === listId) {
        return {
          ...l,
          items: l.items.map(i => ({ ...i, isChecked }))
        };
      }
      return l;
    }));

    try {
      const itemIds = list.items.map(i => i.id);
      const { error } = await (supabase
        .from('shopping_items') as any)
        .update({ is_checked: isChecked })
        .in('id', itemIds);

      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao alternar todos os itens:', err);
      await fetchLists();
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

  const updateItem = async (listId: string, itemId: string, fields: Partial<Omit<ShoppingItem, 'id'>>) => {
    setLists(prev => prev.map(l => {
      if (l.id === listId) {
        return {
          ...l,
          items: l.items.map(i => i.id === itemId ? { ...i, ...fields } : i)
        };
      }
      return l;
    }));

    try {
      const payload: any = {};
      if (fields.name !== undefined) payload.name = fields.name;
      if (fields.category !== undefined) payload.category = fields.category;
      if (fields.quantity !== undefined) payload.quantity = fields.quantity;
      if (fields.unit !== undefined) payload.unit = fields.unit;
      if (fields.estimatedPrice !== undefined) payload.estimated_price = fields.estimatedPrice;
      if (fields.actualPrice !== undefined) payload.actual_price = fields.actualPrice;
      if (fields.isChecked !== undefined) payload.is_checked = fields.isChecked;
      if (fields.position !== undefined) payload.position = fields.position;

      const { error } = await (supabase
        .from('shopping_items') as any)
        .update(payload)
        .eq('id', itemId);

      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao atualizar item:', err);
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
    // Optimistic state update
    setLists(prev => prev.filter(l => l.id !== listId));

    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.setItem('financas_shopping_lists_migrated_done', 'true');
      }
    } catch {}

    try {
      // Delete child items first to prevent foreign key constraint issues
      await supabase
        .from('shopping_items')
        .delete()
        .eq('list_id', listId);

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
      if (updatedData.benefitCardId !== undefined) {
        payload.benefit_card_id = isValidUUID(updatedData.benefitCardId) ? updatedData.benefitCardId : null;
      }
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

  const reuseList = async (listId: string): Promise<string | null> => {
    try {
      const sourceList = lists.find(l => l.id === listId);
      if (!sourceList) return null;

      const newTitle = `${sourceList.title} (Cópia)`;
      const newListId = await createList(newTitle, sourceList.description, sourceList.benefitCardId);
      if (!newListId) return null;

      if (sourceList.items.length > 0) {
        const itemsToCopy: Omit<ShoppingItem, 'id' | 'isChecked'>[] = sourceList.items.map((item, idx) => ({
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          unit: item.unit,
          estimatedPrice: item.actualPrice > 0 ? item.actualPrice : item.estimatedPrice,
          actualPrice: item.actualPrice > 0 ? item.actualPrice : item.estimatedPrice,
          position: idx
        }));

        await addMultipleItems(newListId, itemsToCopy);
      }

      await fetchLists();
      return newListId;
    } catch (err: any) {
      console.error('Erro ao reutilizar lista:', err);
      setError(err.message);
      return null;
    }
  };

  return {
    lists,
    loading,
    error,
    refreshData: fetchLists,
    createList,
    createListWithItems,
    updateList,
    addItem,
    addMultipleItems,
    moveItem,
    reorderListByAisle,
    toggleItem,
    toggleAllItems,
    updateItemPrice,
    updateItem,
    deleteItem,
    deleteList,
    completeList,
    reuseList
  };
}

