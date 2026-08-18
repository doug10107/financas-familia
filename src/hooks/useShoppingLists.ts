import { useState, useEffect } from 'react';

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

const DEFAULT_LISTS: ShoppingList[] = [
  {
    id: 'list-1',
    title: 'Supermercado do Mês',
    description: 'Compras principais para a casa',
    createdAt: new Date().toISOString().split('T')[0],
    isCompleted: false,
    benefitCardId: 'va-1',
    items: [
      { id: 'item-1', name: 'Arroz 5kg', category: 'Alimentação', quantity: 2, estimatedPrice: 32.00, actualPrice: 29.90, isChecked: true },
      { id: 'item-2', name: 'Feijão Carioca 1kg', category: 'Alimentação', quantity: 3, estimatedPrice: 9.00, actualPrice: 8.50, isChecked: true },
      { id: 'item-3', name: 'Leite Integral 1L', category: 'Alimentação', quantity: 12, estimatedPrice: 5.50, actualPrice: 5.20, isChecked: false },
      { id: 'item-4', name: 'Azeite de Oliva', category: 'Alimentação', quantity: 1, estimatedPrice: 42.00, actualPrice: 39.90, isChecked: false },
      { id: 'item-5', name: 'Detergente Líquido', category: 'Limpeza', quantity: 4, estimatedPrice: 3.50, actualPrice: 3.20, isChecked: false }
    ]
  },
  {
    id: 'list-2',
    title: 'Açougue da Semana',
    description: 'Carnes e proteínas',
    createdAt: new Date().toISOString().split('T')[0],
    isCompleted: false,
    benefitCardId: 'va-2',
    items: [
      { id: 'item-6', name: 'Peito de Frango 1kg', category: 'Alimentação', quantity: 3, estimatedPrice: 22.00, actualPrice: 19.90, isChecked: false },
      { id: 'item-7', name: 'Carne Moída 1kg', category: 'Alimentação', quantity: 2, estimatedPrice: 35.00, actualPrice: 33.50, isChecked: false }
    ]
  }
];

export function useShoppingLists() {
  const [lists, setLists] = useState<ShoppingList[]>(DEFAULT_LISTS);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setLists(JSON.parse(saved));
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_LISTS));
      }
    } catch (e) {
      console.error('Erro ao carregar listas de compras:', e);
    }
  }, []);

  const saveLists = (newLists: ShoppingList[]) => {
    setLists(newLists);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newLists));
    } catch (e) {
      console.error('Erro ao salvar listas de compras:', e);
    }
  };

  const createList = (title: string, description?: string, benefitCardId?: string) => {
    const newList: ShoppingList = {
      id: `list-${Date.now()}`,
      title,
      description,
      createdAt: new Date().toISOString().split('T')[0],
      isCompleted: false,
      benefitCardId: benefitCardId || 'va-1',
      items: []
    };
    saveLists([newList, ...lists]);
  };

  const addItem = (listId: string, item: Omit<ShoppingItem, 'id' | 'isChecked'>) => {
    const newItem: ShoppingItem = {
      ...item,
      id: `item-${Date.now()}`,
      isChecked: false
    };

    const updated = lists.map(l => {
      if (l.id === listId) {
        return { ...l, items: [...l.items, newItem] };
      }
      return l;
    });

    saveLists(updated);
  };

  const toggleItem = (listId: string, itemId: string) => {
    const updated = lists.map(l => {
      if (l.id === listId) {
        const updatedItems = l.items.map(item => {
          if (item.id === itemId) {
            return { ...item, isChecked: !item.isChecked };
          }
          return item;
        });
        return { ...l, items: updatedItems };
      }
      return l;
    });

    saveLists(updated);
  };

  const updateItemPrice = (listId: string, itemId: string, actualPrice: number) => {
    const updated = lists.map(l => {
      if (l.id === listId) {
        const updatedItems = l.items.map(item => {
          if (item.id === itemId) {
            return { ...item, actualPrice };
          }
          return item;
        });
        return { ...l, items: updatedItems };
      }
      return l;
    });

    saveLists(updated);
  };

  const deleteItem = (listId: string, itemId: string) => {
    const updated = lists.map(l => {
      if (l.id === listId) {
        return { ...l, items: l.items.filter(i => i.id !== itemId) };
      }
      return l;
    });

    saveLists(updated);
  };

  const deleteList = (listId: string) => {
    saveLists(lists.filter(l => l.id !== listId));
  };

  const updateList = (listId: string, updatedData: Partial<Omit<ShoppingList, 'id' | 'items'>>) => {
    const updated = lists.map(l => {
      if (l.id === listId) {
        return { ...l, ...updatedData };
      }
      return l;
    });
    saveLists(updated);
  };

  const completeList = (listId: string) => {
    const updated = lists.map(l => {
      if (l.id === listId) {
        return { ...l, isCompleted: true };
      }
      return l;
    });

    saveLists(updated);
  };

  return {
    lists,
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
