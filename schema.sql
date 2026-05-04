-- SQL para criar as tabelas no Supabase

-- Grupos do WhatsApp monitorados
CREATE TABLE IF NOT EXISTS public.whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_jid TEXT UNIQUE NOT NULL,
  group_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mensagens brutas capturadas
CREATE TABLE IF NOT EXISTS public.raw_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_jid TEXT NOT NULL,
  message_id TEXT UNIQUE NOT NULL,
  sender TEXT,
  body TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Eventos extraídos das mensagens
CREATE TABLE IF NOT EXISTS public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_message_id UUID REFERENCES public.raw_messages(id),
  title TEXT NOT NULL,
  description TEXT,
  starts_at TIMESTAMPTZ,
  event_time TIME,
  location TEXT,
  guest_count INTEGER,
  organizer TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled')),
  google_event_id TEXT,
  google_calendar_link TEXT,
  tags TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações OAuth Google por usuário
CREATE TABLE IF NOT EXISTS public.google_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  token_expiry TIMESTAMPTZ,
  calendar_id TEXT DEFAULT 'primary',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de Configurações gerais
CREATE TABLE IF NOT EXISTS public.settings (
    key TEXT PRIMARY KEY,
    value JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.raw_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- Índices
CREATE INDEX IF NOT EXISTS idx_raw_messages_processed ON public.raw_messages(processed);
CREATE INDEX IF NOT EXISTS idx_events_date ON public.events(starts_at);
CREATE INDEX IF NOT EXISTS idx_events_google_id ON public.events(google_event_id);
