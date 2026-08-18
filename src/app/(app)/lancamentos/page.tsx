'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GlassCard } from '@/components/ui/GlassCard';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { useTransactions, Transaction } from '@/hooks/useTransactions';
import { useCreditCards } from '@/hooks/useCreditCards';
import { useBenefitCards } from '@/hooks/useBenefitCards';

export default function TransactionsPage() {
  const router = useRouter();
  const { transactions, categories, loading: loadingTx, error: txError, addTransaction, updateTransaction, deleteTransaction, addCategory, deleteCategory } = useTransactions();
  const { creditCards, loading: loadingCards } = useCreditCards();
  const { cards: benefitCards, debitBalance: debitBenefitBalance } = useBenefitCards();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterMonth, setFilterMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`; // e.g. "2026-08"
  });
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  
  // Nova Categoria Modal State
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [isSubmittingCat, setIsSubmittingCat] = useState(false);
  const [catFormError, setCatFormError] = useState('');
  const [catForm, setCatForm] = useState({
    name: '',
    type: 'despesa' as 'receita' | 'despesa' | 'ambos',
    icon: 'category',
    color: '#6c7a71'
  });
  
  const [formData, setFormData] = useState({
    type: 'despesa' as 'receita' | 'despesa',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    category_id: '',
    status: 'pago' as 'pago' | 'pendente' | 'cancelado',
    payment_method: 'conta' as 'conta' | 'cartao' | 'beneficio',
    credit_card_id: '',
    benefit_card_id: '',
    installments: '1',
    repeat_monthly: false,
    repeat_until: `${new Date().getFullYear()}-12`
  });
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
  };

  const filteredTransactions = transactions.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterCategory !== 'all' && t.category_id !== filterCategory) return false;
    if (filterMonth !== 'all') {
      const tDate = t.date.substring(0, 7); // "YYYY-MM" from "YYYY-MM-DD"
      if (tDate !== filterMonth) return false;
    }
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      const descriptionMatch = t.description?.toLowerCase().includes(query);
      const categoryMatch = t.category?.name?.toLowerCase().includes(query);
      if (!descriptionMatch && !categoryMatch) return false;
    }
    return true;
  });

  const handleOpenModal = (transaction?: Transaction, isDuplicate = false) => {
    setFormError('');
    setIsDuplicate(isDuplicate);
    if (transaction) {
      setEditingId(isDuplicate ? null : transaction.id);
      setFormData({
        type: transaction.type,
        amount: transaction.amount.toString(),
        description: transaction.description,
        date: transaction.date,
        category_id: transaction.category_id || '',
        status: transaction.status,
        payment_method: transaction.credit_card_id ? 'cartao' : 'conta',
        credit_card_id: transaction.credit_card_id || '',
        benefit_card_id: '',
        installments: '1', // Editing always edits 1 installment
        repeat_monthly: false,
        repeat_until: `${new Date().getFullYear()}-12`
      });
    } else {
      setEditingId(null);
      setFormData({
        type: 'despesa',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        category_id: '',
        status: 'pago',
        payment_method: 'conta',
        credit_card_id: creditCards.length > 0 ? creditCards[0].id : '',
        benefit_card_id: benefitCards.length > 0 ? benefitCards[0].id : '',
        installments: '1',
        repeat_monthly: false,
        repeat_until: `${new Date().getFullYear()}-12`
      });
    }
    setIsModalOpen(true);
  };

  const handleCreateCategory = async () => {
    if (!catForm.name) {
      setCatFormError('Por favor, preencha o nome da categoria.');
      return;
    }
    
    setIsSubmittingCat(true);
    setCatFormError('');

    const newCat = await addCategory({
      name: catForm.name,
      type: catForm.type,
      icon: catForm.icon,
      color: catForm.color
    });

    setIsSubmittingCat(false);
    if (newCat) {
      setFormData(prev => ({ ...prev, category_id: newCat.id }));
      setIsNewCatModalOpen(false);
    } else {
      setCatFormError('Erro ao criar categoria. Tente novamente.');
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este lançamento?')) {
      await deleteTransaction(id);
    }
  };

  const handleSubmit = async () => {
    if (!formData.amount || !formData.description || !formData.category_id || !formData.date) {
      setFormError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    
    if (formData.payment_method === 'cartao' && !formData.credit_card_id) {
      setFormError('Por favor, selecione um cartão de crédito.');
      return;
    }

    if (formData.payment_method === 'beneficio' && !formData.benefit_card_id) {
      setFormError('Por favor, selecione um cartão de benefício (VA / VR).');
      return;
    }
    
    setIsSubmitting(true);
    setFormError('');
    
    let success = false;

    // Achar o cartão selecionado
    const selectedCard = formData.payment_method === 'cartao' 
      ? creditCards.find(c => c.id === formData.credit_card_id) 
      : null;

    const parsedAmount = parseFloat(formData.amount.replace(',', '.'));

    const payload = {
      type: formData.type,
      amount: parsedAmount,
      description: formData.description,
      date: formData.date, // Data da compra
      category_id: formData.category_id,
      status: formData.payment_method === 'beneficio' ? ('pago' as const) : formData.status,
      credit_card_id: selectedCard ? selectedCard.id : null,
      installments: parseInt(formData.installments) || 1,
      card_due_day: selectedCard ? selectedCard.due_day : undefined,
      card_closing_day: selectedCard ? selectedCard.closing_day : undefined,
      repeat_until: formData.repeat_monthly ? formData.repeat_until : undefined
    };

    if (formData.payment_method === 'beneficio') {
      const selectedBenefit = benefitCards.find(c => c.id === formData.benefit_card_id);
      if (selectedBenefit) {
        const cat = categories.find(c => c.id === formData.category_id);
        debitBenefitBalance(selectedBenefit.id, parsedAmount, formData.description, cat?.name || 'Alimentação');
      }
    }

    if (editingId) {
      // Quando editar, não suporta alterar as parcelas para não gerar bagunça (editar altera só aquela)
      success = await updateTransaction(editingId, {
        type: payload.type,
        amount: payload.amount,
        description: payload.description,
        date: payload.date,
        category_id: payload.category_id,
        status: payload.status,
      });
    } else {
      success = await addTransaction(payload);
    }

    setIsSubmitting(false);
    if (success) {
      setIsModalOpen(false);
    } else {
      setFormError('Erro ao salvar lançamento. Tente novamente.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lançamentos</h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Gerencie suas receitas e despesas</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button variant="secondary" onClick={() => router.push('/importar')} className="flex-1 sm:flex-none">
            <Icon name="file_upload" className="w-4 h-4 mr-2 text-purple-600 dark:text-purple-400" /> 
            Importar Extrato / PDF
          </Button>
          <Button variant="primary" onClick={() => handleOpenModal()} className="flex-1 sm:flex-none">
            <Icon name="add" className="w-4 h-4 mr-2" /> 
            Novo Lançamento
          </Button>
        </div>
      </div>

      <GlassCard className="p-4 md:p-6">
        <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
          <div className="flex gap-2">
            <Button 
              variant={filterType === 'all' ? 'primary' : 'secondary'} 
              size="sm" 
              onClick={() => setFilterType('all')}
            >
              Todos
            </Button>
            <Button 
              variant={filterType === 'receita' ? 'primary' : 'secondary'} 
              size="sm" 
              onClick={() => setFilterType('receita')}
              className={filterType === 'receita' ? 'bg-wealth-green hover:bg-green-600 border-wealth-green text-white' : 'text-wealth-green border-wealth-green/30 hover:bg-green-50 dark:hover:bg-green-900/20'}
            >
              Receitas
            </Button>
            <Button 
              variant={filterType === 'despesa' ? 'primary' : 'secondary'} 
              size="sm" 
              onClick={() => setFilterType('despesa')}
              className={filterType === 'despesa' ? 'bg-red-500 hover:bg-red-600 border-red-500 text-white' : 'text-red-500 border-red-500/30 hover:bg-red-50 dark:hover:bg-red-900/20'}
            >
              Despesas
            </Button>
            
            <div className="w-40 ml-2">
              <Select 
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
                options={[
                  {value: 'all', label: 'Todos os Meses'},
                  // Generate last 3 months, current, and next 12 months dynamically based on data or just a fixed list
                  ...Array.from({length: 24}, (_, i) => {
                    const d = new Date();
                    d.setMonth(d.getMonth() - 6 + i); // From 6 months ago to 17 months ahead
                    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(d);
                    return { value: val, label: label.charAt(0).toUpperCase() + label.slice(1) };
                  })
                ]} 
              />
            </div>

            <div className="w-48 ml-2">
              <Select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                options={[
                  {value: 'all', label: 'Todas as Categorias'},
                  ...categories
                    .filter(c => filterType === 'all' || c.type === filterType || c.type === 'ambos')
                    .map(c => ({ value: c.id, label: c.name }))
                ]} 
              />
            </div>
          </div>
          <div className="w-full md:w-64">
            <Input 
              placeholder="Buscar lançamento..." 
              prefix="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {txError && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
            {txError}
          </div>
        )}

        <div className="overflow-x-auto">
          {loadingTx ? (
            <div className="py-12 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredTransactions.length > 0 ? (
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 dark:bg-gray-800/50 dark:text-gray-400">
                <tr>
                  <th scope="col" className="px-4 py-3 rounded-l-lg">Data</th>
                  <th scope="col" className="px-4 py-3">Descrição</th>
                  <th scope="col" className="px-4 py-3">Categoria</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3 text-right">Valor</th>
                  <th scope="col" className="px-4 py-3 text-center rounded-r-lg">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((transaction) => (
                  <tr key={transaction.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                      {formatDate(transaction.date)}
                    </td>
                    <td className="px-4 py-4 font-medium text-gray-900 dark:text-white">
                      {transaction.description}
                      {transaction.credit_card_id && (
                        <span className="ml-2 inline-flex items-center text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded uppercase font-bold">
                          Cartão
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        {transaction.category && (
                          <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ backgroundColor: transaction.category.color }}>
                            <Icon name={transaction.category.icon} size="sm" className="text-white text-[10px]" />
                          </div>
                        )}
                        <span>{transaction.category?.name || 'Sem Categoria'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      {transaction.status === 'pendente' ? (
                         <Badge color="yellow">Pendente</Badge>
                      ) : (
                         <Badge color="green">Pago</Badge>
                      )}
                    </td>
                    <td className={`px-4 py-4 text-right font-semibold whitespace-nowrap ${transaction.type === 'receita' ? 'text-wealth-green dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                      {transaction.type === 'despesa' ? '-' : '+'} {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleOpenModal(transaction, true)}
                          className="p-1.5 text-gray-400 hover:text-green-500 transition-colors rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20"
                          title="Duplicar"
                        >
                          <Icon name="content_copy" size="sm" />
                        </button>
                        <button 
                          onClick={() => handleOpenModal(transaction)}
                          className="p-1.5 text-gray-400 hover:text-[#0058be] dark:hover:text-[#adc6ff] transition-colors rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                          title="Editar"
                        >
                          <Icon name="edit" size="sm" />
                        </button>
                        <button 
                          onClick={() => handleDelete(transaction.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                          title="Excluir"
                        >
                          <Icon name="delete" size="sm" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="py-12">
              <EmptyState 
                title="Nenhum lançamento encontrado" 
                description="Não há lançamentos que correspondam aos filtros atuais." 
                icon="search"
              />
            </div>
          )}
        </div>
      </GlassCard>

      <Modal 
        isOpen={isModalOpen} 
        onClose={() => !isSubmitting && setIsModalOpen(false)} 
        title={editingId ? "Editar Lançamento" : "Novo Lançamento"}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button 
              variant="secondary" 
              className={formData.type === 'receita' ? 'bg-wealth-green text-white border-wealth-green' : 'border-wealth-green text-wealth-green hover:bg-green-50 dark:hover:bg-green-900/20'}
              onClick={() => setFormData({...formData, type: 'receita', category_id: ''})}
            >
              Receita
            </Button>
            <Button 
              variant="secondary" 
              className={formData.type === 'despesa' ? 'bg-red-500 text-white border-red-500' : 'border-red-500 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20'}
              onClick={() => setFormData({...formData, type: 'despesa', category_id: ''})}
            >
              Despesa
            </Button>
          </div>
          
          {formError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label={formData.payment_method === 'cartao' ? "Valor Total da Compra (R$)" : "Valor (R$)"} 
              type="number" 
              step="0.01"
              placeholder="0,00" 
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
            />
            <Input 
              label="Descrição" 
              placeholder="Ex: Supermercado" 
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input 
              label={formData.payment_method === 'cartao' ? "Data da Compra" : "Data"} 
              type="date" 
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
            />
            <div className="flex flex-col gap-1.5 w-full">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Categoria
                </label>
                <button 
                  type="button"
                  onClick={() => {
                    setCatForm({
                      name: '',
                      type: formData.type,
                      icon: 'category',
                      color: '#6c7a71'
                    });
                    setCatFormError('');
                    setIsNewCatModalOpen(true);
                  }}
                  className="text-xs text-[#0058be] dark:text-[#adc6ff] hover:underline flex items-center gap-1 font-semibold"
                >
                  <Icon name="add" className="w-3 h-3" />
                  Nova Categoria
                </button>
              </div>
              <Select 
                value={formData.category_id}
                onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                options={[
                  {value: '', label: 'Selecione...'},
                  ...categories
                    .filter(c => c.type === formData.type || c.type === 'ambos')
                    .map(c => ({ value: c.id, label: c.name }))
                ]} 
              />
            </div>
          </div>
          
          {formData.type === 'despesa' && (
            <div className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl space-y-4 border border-gray-100 dark:border-gray-800">
              <Select 
                label="Meio de Pagamento" 
                value={formData.payment_method}
                onChange={(e) => setFormData({...formData, payment_method: e.target.value as any})}
                options={[
                  {value: 'conta', label: 'Dinheiro / Pix / Débito'},
                  {value: 'cartao', label: 'Cartão de Crédito'},
                  {value: 'beneficio', label: 'Cartão de Benefício (VA / VR)'}
                ]} 
              />

              {formData.payment_method === 'beneficio' && (
                <div className="grid grid-cols-1 gap-4">
                  <Select 
                    label="Qual Benefício?" 
                    value={formData.benefit_card_id}
                    onChange={(e) => setFormData({...formData, benefit_card_id: e.target.value})}
                    options={
                      benefitCards.length > 0 
                        ? benefitCards.map(c => ({ value: c.id, label: `${c.name} (${formatCurrency(c.balance)})` }))
                        : [{value: '', label: 'Nenhum vale cadastrado'}]
                    }
                  />
                </div>
              )}

              {formData.payment_method === 'cartao' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Select 
                    label="Qual Cartão?" 
                    value={formData.credit_card_id}
                    onChange={(e) => setFormData({...formData, credit_card_id: e.target.value})}
                    options={
                      creditCards.length > 0 
                        ? creditCards.map(c => ({ value: c.id, label: c.name }))
                        : [{value: '', label: 'Nenhum cartão cadastrado'}]
                    }
                  />
                  {!editingId && (
                    <Select 
                      label="Parcelamento" 
                      value={formData.installments}
                      onChange={(e) => setFormData({...formData, installments: e.target.value})}
                      options={Array.from({length: 12}, (_, i) => ({ value: String(i + 1), label: i === 0 ? 'À vista (1x)' : `${i + 1}x` }))}
                    />
                  )}
                </div>
              )}
            </div>
          )}
          
          {formData.payment_method === 'conta' && (
            <Select 
              label="Status" 
              value={formData.status}
              onChange={(e) => setFormData({...formData, status: e.target.value as any})}
              options={[
                {value: 'pago', label: 'Pago/Recebido'},
                {value: 'pendente', label: 'Pendente'}
              ]} 
            />
          )}

          {!editingId && formData.payment_method === 'conta' && (
            <div className="bg-gray-50/50 dark:bg-gray-800/30 p-4 rounded-xl space-y-4 border border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <input 
                  type="checkbox"
                  id="repeat_monthly"
                  checked={formData.repeat_monthly}
                  onChange={(e) => setFormData({...formData, repeat_monthly: e.target.checked})}
                  className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
                />
                <label htmlFor="repeat_monthly" className="text-sm font-medium text-gray-700 dark:text-gray-300 select-none">
                  Repetir lançamento mensalmente?
                </label>
              </div>

              {formData.repeat_monthly && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Select 
                      label="Repetir até o mês" 
                      value={formData.repeat_until}
                      onChange={(e) => setFormData({...formData, repeat_until: e.target.value})}
                      options={Array.from({length: 24}, (_, i) => {
                        const d = new Date();
                        d.setMonth(d.getMonth() + i); // current and future months
                        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                        const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(d);
                        return { value: val, label: label.charAt(0).toUpperCase() + label.slice(1) };
                      })}
                    />
                  </div>

                  {isDuplicate && (
                    <div className="p-3 bg-yellow-50 text-yellow-800 dark:bg-yellow-950/20 dark:text-yellow-300 rounded-xl text-xs space-y-2 border border-yellow-100 dark:border-yellow-900/30">
                      <p className="font-semibold flex items-center gap-1">
                        <Icon name="warning" size="sm" /> Atenção à Duplicação
                      </p>
                      <p>
                        Você está duplicando um lançamento que já existe na data original. Para não ter o mesmo valor duplicado neste primeiro mês, você pode adiantar a data inicial deste grupo repetido para o mês que vem:
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          const d = new Date(formData.date + 'T12:00:00');
                          d.setMonth(d.getMonth() + 1);
                          const yyyy = d.getFullYear();
                          const mm = String(d.getMonth() + 1).padStart(2, '0');
                          const dd = String(d.getDate()).padStart(2, '0');
                          setFormData({ ...formData, date: `${yyyy}-${mm}-${dd}` });
                        }}
                        className="text-xs text-primary font-bold hover:underline inline-flex items-center gap-1"
                      >
                        Ajustar data para: {(() => {
                          const d = new Date(formData.date + 'T12:00:00');
                          d.setMonth(d.getMonth() + 1);
                          return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
                        })()}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {formData.payment_method === 'cartao' && !editingId && (
            <p className="text-xs text-gray-500 italic mt-2">
              As faturas serão geradas automaticamente como "Pendentes" nas datas de vencimento do cartão selecionado.
            </p>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isSubmitting}>Cancelar</Button>
            <Button variant="primary" onClick={handleSubmit} loading={isSubmitting}>
              {editingId ? "Salvar Alterações" : "Salvar Lançamento"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal - Nova Categoria */}
      <Modal
        isOpen={isNewCatModalOpen}
        onClose={() => !isSubmittingCat && setIsNewCatModalOpen(false)}
        title="Nova Categoria"
      >
        <div className="space-y-4">
          {catFormError && (
            <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm">
              {catFormError}
            </div>
          )}

          <Input 
            label="Nome da Categoria" 
            placeholder="Ex: Presentes, Cuidados Pessoais" 
            value={catForm.name}
            onChange={(e) => setCatForm({...catForm, name: e.target.value})}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select 
              label="Tipo" 
              value={catForm.type}
              onChange={(e) => setCatForm({...catForm, type: e.target.value as any})}
              options={[
                { value: 'despesa', label: 'Despesa' },
                { value: 'receita', label: 'Receita' },
                { value: 'ambos', label: 'Ambos' }
              ]}
            />
            <Select 
              label="Ícone" 
              value={catForm.icon}
              onChange={(e) => setCatForm({...catForm, icon: e.target.value})}
              options={[
                { value: 'category', label: 'Padrão' },
                { value: 'card_giftcard', label: 'Presente / Brinde' },
                { value: 'restaurant', label: 'Comida' },
                { value: 'home', label: 'Casa' },
                { value: 'directions_car', label: 'Carro' },
                { value: 'health_and_safety', label: 'Saúde' },
                { value: 'school', label: 'Educação' },
                { value: 'sports_esports', label: 'Lazer' },
                { value: 'checkroom', label: 'Roupas' },
                { value: 'celebration', label: 'Festa' },
                { value: 'shopping_bag', label: 'Compras' },
                { value: 'medical_services', label: 'Médico' }
              ]}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Cor</label>
            <div className="flex flex-wrap gap-2">
              {[
                '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4', 
                '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', 
                '#6b7280', '#6c7a71'
              ].map(color => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-full border-2 transition-all ${catForm.color === color ? 'border-primary scale-110 shadow' : 'border-transparent hover:scale-105'}`}
                  style={{ backgroundColor: color }}
                  onClick={() => setCatForm({...catForm, color})}
                />
              ))}
            </div>
          </div>

          {/* List of custom categories */}
          {categories.filter(c => !c.is_default).length > 0 && (
            <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Minhas Categorias Customizadas</h4>
              <div className="max-h-32 overflow-y-auto space-y-2 pr-1">
                {categories
                  .filter(c => !c.is_default)
                  .map(c => (
                    <div key={c.id} className="flex justify-between items-center p-2 rounded-lg bg-gray-50 dark:bg-gray-800/40">
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white" style={{ backgroundColor: c.color }}>
                          <Icon name={c.icon} size="sm" />
                        </div>
                        <span className="text-xs text-gray-900 dark:text-white font-medium">{c.name} ({c.type === 'ambos' ? 'receita/despesa' : c.type})</span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (window.confirm(`Excluir a categoria "${c.name}"? Lançamentos associados ficarão sem categoria.`)) {
                            await deleteCategory(c.id);
                          }
                        }}
                        className="p-1 text-gray-400 hover:text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                        title="Excluir Categoria"
                      >
                        <Icon name="delete" size="sm" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="ghost" onClick={() => setIsNewCatModalOpen(false)} disabled={isSubmittingCat}>Cancelar</Button>
            <Button variant="primary" onClick={handleCreateCategory} loading={isSubmittingCat}>Criar Categoria</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
