ALTER TABLE public.call_sessions
ADD COLUMN IF NOT EXISTS caller_phone text;
