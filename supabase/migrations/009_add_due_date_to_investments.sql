-- Migration 9: Adiciona coluna due_date (Data de Vencimento / Resgate Mínimo) na tabela investments
ALTER TABLE public.investments ADD COLUMN IF NOT EXISTS due_date DATE;
