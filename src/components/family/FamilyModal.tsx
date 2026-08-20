'use client';
import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { useFamily } from '@/hooks/useFamily';

interface FamilyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FamilyModal({ isOpen, onClose }: FamilyModalProps) {
  const { family, loading, copied, copyInviteCode, copyInviteLink, joinFamily } = useFamily();
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinFeedback, setJoinFeedback] = useState<{ text: string; isError: boolean } | null>(null);

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCodeInput.trim()) return;

    setJoinLoading(true);
    setJoinFeedback(null);

    const result = await joinFamily(joinCodeInput);
    setJoinLoading(false);

    if (result.success) {
      setJoinFeedback({ text: result.message, isError: false });
      setTimeout(() => {
        setShowJoinForm(false);
        setJoinFeedback(null);
        setJoinCodeInput('');
      }, 2000);
    } else {
      setJoinFeedback({ text: result.message, isError: true });
    }
  };

  const handleShareWhatsApp = () => {
    if (!family?.invite_code) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const inviteUrl = `${origin}/signup?invite=${encodeURIComponent(family.invite_code)}`;
    const msg = `Oi! Criei nossa conta familiar compartilhada no App de Finanças. Acesse pelo link abaixo para acompanhar e lançar nossas despesas juntos:\n\n${inviteUrl}\n\nCódigo da Família: *${family.invite_code}*`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Gestão da Família Compartilhada"
    >
      <div className="space-y-6">
        {/* Header com Nome da Família */}
        <div className="p-4 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-950/40 dark:to-teal-950/40 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500 text-white flex items-center justify-center font-bold text-xl shadow-md">
              <Icon name="groups" />
            </div>
            <div>
              <h4 className="font-bold text-gray-900 dark:text-white text-base">
                {family?.family_name || 'Minha Família'}
              </h4>
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                Espaço Financeiro Sincronizado
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300">
              {family?.members?.length || 1} {family?.members?.length === 1 ? 'membro' : 'membros'}
            </span>
          </div>
        </div>

        {/* Card do Código de Convite */}
        <div className="bg-gray-50 dark:bg-gray-800/60 p-4 rounded-2xl border border-gray-200/70 dark:border-gray-700/60 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Código de Convite da Família
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                Compartilhe com seu cônjuge para ela entrar nesta mesma conta
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex-1 bg-white dark:bg-gray-900 px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between font-mono text-lg font-bold tracking-widest text-emerald-600 dark:text-emerald-400">
              <span>{family?.invite_code || 'FAM-MENEZES'}</span>
              <button
                type="button"
                onClick={copyInviteCode}
                className="text-gray-400 hover:text-emerald-500 transition-colors"
                title="Copiar Código"
              >
                <Icon name={copied ? 'check' : 'content_copy'} size="sm" />
              </button>
            </div>
            <Button
              type="button"
              variant="primary"
              onClick={copyInviteLink}
              className="shrink-0 flex items-center gap-1.5"
            >
              <Icon name={copied ? 'done_all' : 'link'} size="sm" />
              <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
            </Button>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={handleShareWhatsApp}
              className="w-full py-2.5 px-3 rounded-xl bg-[#25D366]/10 hover:bg-[#25D366]/20 text-[#128C7E] dark:text-[#25D366] text-xs font-semibold transition-colors flex items-center justify-center gap-2 border border-[#25D366]/20"
            >
              <Icon name="share" size="sm" /> Convidar Esposa pelo WhatsApp
            </button>
          </div>
        </div>

        {/* Lista de Membros da Família */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Membros Conectados
            </h5>
            <span className="text-[11px] text-gray-400">Acesso Total Compartilhado</span>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {family?.members && family.members.length > 0 ? (
              family.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-gray-800/40 border border-gray-100 dark:border-gray-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold text-sm shadow-sm">
                      {member.display_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                        {member.display_name}
                        {member.is_current_user && (
                          <span className="text-[10px] bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded font-normal">
                            Você
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400">
                        {member.role === 'admin' ? 'Administrador' : 'Membro da Família'}
                      </p>
                    </div>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" title="Ativo"></span>
                </div>
              ))
            ) : (
              <div className="p-3 text-center text-xs text-gray-400">
                Nenhum membro encontrado
              </div>
            )}
          </div>
        </div>

        {/* Alternar / Entrar em Outra Família */}
        <div className="border-t border-gray-100 dark:border-gray-700/60 pt-3">
          {!showJoinForm ? (
            <button
              type="button"
              onClick={() => setShowJoinForm(true)}
              className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-medium flex items-center gap-1"
            >
              <Icon name="login" size="sm" />
              Já tem outro código de família e quer entrar nela?
            </button>
          ) : (
            <form onSubmit={handleJoinSubmit} className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                Entrar em outra família pelo código:
              </p>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Ex: FAM-XXXX"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  required
                />
                <Button type="submit" size="sm" loading={joinLoading}>
                  Entrar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowJoinForm(false)}>
                  Cancelar
                </Button>
              </div>
              {joinFeedback && (
                <p className={`text-xs font-semibold ${joinFeedback.isError ? 'text-red-500' : 'text-emerald-500'}`}>
                  {joinFeedback.text}
                </p>
              )}
            </form>
          )}
        </div>
      </div>
    </Modal>
  );
}
