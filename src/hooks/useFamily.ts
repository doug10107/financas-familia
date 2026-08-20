'use client';
import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

export type FamilyMember = {
  id: string;
  display_name: string;
  role: 'admin' | 'member';
  avatar_url?: string | null;
  created_at: string;
  is_current_user?: boolean;
};

export type FamilyDetails = {
  family_id: string;
  family_name: string;
  invite_code: string;
  members: FamilyMember[];
};

export function useFamily() {
  const [family, setFamily] = useState<FamilyDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const supabase = createClient();

  const fetchFamily = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Tenta chamar a RPC get_family_details
      const { data, error: rpcError } = await (supabase.rpc as any)('get_family_details');

      if (!rpcError && data && (data as any).family_id) {
        setFamily(data as FamilyDetails);
        return;
      }

      // 2. Fallback direto via tabelas caso a RPC ainda não tenha sido criada no banco
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setFamily(null);
        return;
      }

      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('*, family:families(*)')
        .eq('id', user.id)
        .single() as any;

      if (profErr || !profile) {
        // Mock default para ambiente local ou primeiro uso
        setFamily({
          family_id: 'local-family',
          family_name: 'Minha Família',
          invite_code: 'FAM-MENEZES',
          members: [
            {
              id: user.id,
              display_name: user.user_metadata?.full_name || 'Douglas',
              role: 'admin',
              created_at: new Date().toISOString(),
              is_current_user: true
            }
          ]
        });
        return;
      }

      const familyData = Array.isArray(profile.family) ? profile.family[0] : profile.family;

      // Buscar todos os membros da família
      const { data: allMembers } = await supabase
        .from('profiles')
        .select('id, display_name, role, avatar_url, created_at')
        .eq('family_id', profile.family_id)
        .order('role', { ascending: true }) as any;

      const membersList: FamilyMember[] = (allMembers || [profile]).map((m: any) => ({
        id: m.id,
        display_name: m.display_name,
        role: m.role,
        avatar_url: m.avatar_url,
        created_at: m.created_at,
        is_current_user: m.id === user.id
      }));

      setFamily({
        family_id: profile.family_id,
        family_name: familyData?.name || 'Família',
        invite_code: familyData?.invite_code || 'FAM-' + profile.family_id.slice(0, 4).toUpperCase(),
        members: membersList
      });

    } catch (err: any) {
      console.error('Erro ao buscar dados da família:', err);
      setError(err.message || 'Erro ao carregar família');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchFamily();
  }, [fetchFamily]);

  const copyInviteCode = async () => {
    if (!family?.invite_code) return false;
    try {
      await navigator.clipboard.writeText(family.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return true;
    } catch {
      return false;
    }
  };

  const copyInviteLink = async () => {
    if (!family?.invite_code) return false;
    try {
      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const inviteUrl = `${origin}/signup?invite=${encodeURIComponent(family.invite_code)}`;
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      return true;
    } catch {
      return false;
    }
  };

  const joinFamily = async (inviteCode: string) => {
    setError(null);
    try {
      const { data, error: rpcError } = await (supabase.rpc as any)('join_family_by_code', {
        p_invite_code: inviteCode.trim().toUpperCase()
      });

      if (rpcError) throw rpcError;
      if (data && !(data as any).success) {
        throw new Error((data as any).message || 'Código de convite inválido');
      }

      await fetchFamily();
      return { success: true, message: (data as any)?.message || 'Vinculado com sucesso!' };
    } catch (err: any) {
      const msg = err.message || 'Erro ao vincular família';
      setError(msg);
      return { success: false, message: msg };
    }
  };

  return {
    family,
    loading,
    error,
    copied,
    fetchFamily,
    copyInviteCode,
    copyInviteLink,
    joinFamily
  };
}
