-- Planto – sett ansvarlige for en plante atomisk (erstatter delete+insert
-- i to separate klientkall, som kunne etterlate planten uten ansvarlige).
-- SECURITY INVOKER: RLS-policyene fra 0007 gjelder fortsatt.
create or replace function public.set_plant_responsibles(
  p_plant_id uuid,
  p_user_ids uuid[]
)
returns void
language plpgsql
as $$
begin
  delete from public.plant_responsibles where plant_id = p_plant_id;
  insert into public.plant_responsibles (plant_id, user_id)
  select p_plant_id, u from unnest(coalesce(p_user_ids, '{}')) as u
  on conflict do nothing;
end;
$$;
revoke all on function public.set_plant_responsibles(uuid, uuid[]) from public;
grant execute on function public.set_plant_responsibles(uuid, uuid[]) to authenticated;
