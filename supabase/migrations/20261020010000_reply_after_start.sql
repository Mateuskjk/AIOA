-- Customers can only reply once the team has started on the ticket (assigned it or moved it past "Aberto").
-- The ticket's first message (sent when it's opened) is still allowed.
create or replace function public.customer_can_reply(t bigint) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from tickets where id = t and (assignee is not null or status <> 'Aberto'))
      or not exists (select 1 from messages where ticket_id = t)
$$;

drop policy "messages: member writes public" on public.messages;
create policy "messages: member writes public" on public.messages for insert
  with check (not internal and can_see_ticket(ticket_id) and customer_can_reply(ticket_id));
