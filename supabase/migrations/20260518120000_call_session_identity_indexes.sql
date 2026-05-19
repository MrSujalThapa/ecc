create unique index if not exists call_sessions_twilio_call_sid_unique
on public.call_sessions (twilio_call_sid)
where twilio_call_sid is not null;

create unique index if not exists call_sessions_elevenlabs_conversation_id_unique
on public.call_sessions (elevenlabs_conversation_id)
where elevenlabs_conversation_id is not null;
