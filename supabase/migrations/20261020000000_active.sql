-- Companies and members can be deactivated: their users lose access (data is kept).
alter table public.companies add column active boolean not null default true;
alter table public.members add column active boolean not null default true;

-- A customer only counts as "of a company" while both the member and the company are active.
create or replace function public.my_company() returns uuid language sql stable security definer set search_path = public as $$
  select m.company_id from members m join companies c on c.id = m.company_id
  where lower(m.email) = my_email() and m.active and c.active limit 1
$$;
