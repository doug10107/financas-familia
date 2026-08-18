export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      families: {
        Row: {
          id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          family_id: string | null
          first_name: string
          last_name: string
          avatar_url: string | null
          role: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          family_id?: string | null
          first_name: string
          last_name: string
          avatar_url?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string | null
          first_name?: string
          last_name?: string
          avatar_url?: string | null
          role?: string
          created_at?: string
          updated_at?: string
        }
      }
      categories: {
        Row: {
          id: string
          family_id: string
          name: string
          type: 'receita' | 'despesa'
          color: string | null
          icon: string | null
          created_at: string
        }
        Insert: {
          id?: string
          family_id: string
          name: string
          type: 'receita' | 'despesa'
          color?: string | null
          icon?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          name?: string
          type?: 'receita' | 'despesa'
          color?: string | null
          icon?: string | null
          created_at?: string
        }
      }
      transactions: {
        Row: {
          id: string
          family_id: string
          profile_id: string
          category_id: string | null
          amount: number
          type: 'receita' | 'despesa'
          description: string
          date: string
          status: 'pago' | 'pendente' | 'cancelado'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          profile_id: string
          category_id?: string | null
          amount: number
          type: 'receita' | 'despesa'
          description: string
          date: string
          status?: 'pago' | 'pendente' | 'cancelado'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          profile_id?: string
          category_id?: string | null
          amount?: number
          type?: 'receita' | 'despesa'
          description?: string
          date?: string
          status?: 'pago' | 'pendente' | 'cancelado'
          created_at?: string
          updated_at?: string
        }
      }
      goals: {
        Row: {
          id: string
          family_id: string
          name: string
          target_amount: number
          current_amount: number
          deadline: string | null
          status: 'em_andamento' | 'concluida' | 'cancelada'
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          name: string
          target_amount: number
          current_amount?: number
          deadline?: string | null
          status?: 'em_andamento' | 'concluida' | 'cancelada'
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          name?: string
          target_amount?: number
          current_amount?: number
          deadline?: string | null
          status?: 'em_andamento' | 'concluida' | 'cancelada'
          color?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      goal_contributions: {
        Row: {
          id: string
          goal_id: string
          profile_id: string
          amount: number
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          goal_id: string
          profile_id: string
          amount: number
          date: string
          created_at?: string
        }
        Update: {
          id?: string
          goal_id?: string
          profile_id?: string
          amount?: number
          date?: string
          created_at?: string
        }
      }
      investment_types: {
        Row: {
          id: string
          name: string
          description: string | null
          risk_level: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          risk_level?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          risk_level?: string | null
        }
      }
      investments: {
        Row: {
          id: string
          family_id: string
          investment_type_id: string | null
          name: string
          balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          investment_type_id?: string | null
          name: string
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          investment_type_id?: string | null
          name?: string
          balance?: number
          created_at?: string
          updated_at?: string
        }
      }
      investment_entries: {
        Row: {
          id: string
          investment_id: string
          profile_id: string
          type: 'aporte' | 'resgate' | 'rendimento'
          amount: number
          date: string
          created_at: string
        }
        Insert: {
          id?: string
          investment_id: string
          profile_id: string
          type: 'aporte' | 'resgate' | 'rendimento'
          amount: number
          date: string
          created_at?: string
        }
        Update: {
          id?: string
          investment_id?: string
          profile_id?: string
          type?: 'aporte' | 'resgate' | 'rendimento'
          amount?: number
          date?: string
          created_at?: string
        }
      }
      benefit_cards: {
        Row: {
          id: string
          family_id: string
          user_id: string
          name: string
          type: 'va' | 'vr'
          balance: number
          recharge_amount: number
          recharge_day: number
          color: string
          icon: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          user_id: string
          name: string
          type: 'va' | 'vr'
          balance?: number
          recharge_amount?: number
          recharge_day: number
          color?: string
          icon?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          user_id?: string
          name?: string
          type?: 'va' | 'vr'
          balance?: number
          recharge_amount?: number
          recharge_day?: number
          color?: string
          icon?: string
          created_at?: string
          updated_at?: string
        }
      }
      benefit_transactions: {
        Row: {
          id: string
          card_id: string
          user_id: string
          description: string
          amount: number
          date: string
          type: 'debito' | 'recarga'
          category_name: string | null
          created_at: string
        }
        Insert: {
          id?: string
          card_id: string
          user_id: string
          description: string
          amount: number
          date?: string
          type: 'debito' | 'recarga'
          category_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          card_id?: string
          user_id?: string
          description?: string
          amount?: number
          date?: string
          type?: 'debito' | 'recarga'
          category_name?: string | null
          created_at?: string
        }
      }
      shopping_lists: {
        Row: {
          id: string
          family_id: string
          user_id: string
          benefit_card_id: string | null
          title: string
          description: string | null
          is_completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          family_id: string
          user_id: string
          benefit_card_id?: string | null
          title: string
          description?: string | null
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          family_id?: string
          user_id?: string
          benefit_card_id?: string | null
          title?: string
          description?: string | null
          is_completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      shopping_items: {
        Row: {
          id: string
          list_id: string
          name: string
          category: string
          quantity: number
          estimated_price: number
          actual_price: number
          is_checked: boolean
          created_at: string
        }
        Insert: {
          id?: string
          list_id: string
          name: string
          category?: string
          quantity?: number
          estimated_price?: number
          actual_price?: number
          is_checked?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          list_id?: string
          name?: string
          category?: string
          quantity?: number
          estimated_price?: number
          actual_price?: number
          is_checked?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_dashboard_data: {
        Args: {
          p_family_id: string
          p_start_date: string
          p_end_date: string
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
