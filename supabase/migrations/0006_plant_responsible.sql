-- Planto – ansvarlig person per plante.
-- Hver plante kan ha én ansvarlig bruker, som må være en profil i samme
-- husstand. Klienten setter standardverdien til den som oppretter planten, og
-- lar den endres til et annet husstandsmedlem fra en nedtrekksliste.
--
-- NULL = ingen ansvarlig (også verdien for planter som fantes før denne
-- migrasjonen). `on delete set null` rydder opp dersom en bruker forlater
-- husstanden. Husstand-grensen håndheves av klienten (nedtrekkslisten viser
-- bare egne medlemmer); RLS-policyen plants_all dekker allerede den nye
-- kolonnen siden den gjelder hele raden innenfor husstanden.

alter table public.plants
  add column if not exists responsible_user_id uuid
    references public.profiles (id) on delete set null;

create index if not exists plants_responsible_idx
  on public.plants (responsible_user_id);
