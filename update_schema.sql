-- Adicionar group_jid na tabela de eventos para rastreamento
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS group_jid TEXT;

-- Adicionar campo de tags na tabela de eventos
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS tags TEXT;

-- Opcional: Criar índice para o group_jid na tabela de eventos
CREATE INDEX IF NOT EXISTS idx_events_group_jid ON public.events(group_jid);
