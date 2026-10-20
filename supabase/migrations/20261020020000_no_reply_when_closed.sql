-- A closed ticket (resolved, closed, cancelled or rejected) no longer takes customer replies:
-- a new problem means a new ticket. The ticket's first message is still allowed.
create or replace function public.customer_can_reply(t bigint) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
           select 1 from tickets where id = t
             and (assignee is not null or status <> 'Aberto')
             and status not in ('Resolvido', 'Fechado', 'Cancelado', 'Reprovado'))
      or not exists (select 1 from messages where ticket_id = t)
$$;
