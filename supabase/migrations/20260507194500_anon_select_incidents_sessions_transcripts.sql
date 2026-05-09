-- Allow browser (anon key) to read incidents / call_sessions / transcript_events for
-- dashboard + Supabase Realtime. Writes remain via service-role API routes.
-- Adjust or tighten policies before production.

create policy "incidents_select_anon"
  on public.incidents
  for select
  to anon
  using (true);

create policy "call_sessions_select_anon"
  on public.call_sessions
  for select
  to anon
  using (true);

create policy "transcript_events_select_anon"
  on public.transcript_events
  for select
  to anon
  using (true);
