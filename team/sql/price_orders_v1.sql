-- DRAGAN Manager · Заявки с прайса · v1 (28.11.2026)
-- Зачем: заявка клиента сохраняется в базе, а в WhatsApp уходит короткое сообщение со ссылкой.
-- Длинные оптовые заявки больше не обрезаются, все заявки видны в кабинете.
-- Запускать один раз в Supabase проекта dragan-manager: SQL Editor → вставить всё → Run.
-- Повторный запуск безопасен. Ничего существующего не удаляет и не меняет.
-- Ожидаемый результат в конце: строка «Заявки с прайса v1 — OK».

-- 1. Кто сотрудник (та же функция, что у договоров; если уже есть — перезапишется такой же).
create or replace function public.dg_staff_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.staff_access
  where user_id = auth.uid() and active and role in ('admin', 'manager')
  limit 1
$$;
revoke all on function public.dg_staff_role() from public, anon;
grant execute on function public.dg_staff_role() to authenticated;

-- 2. Таблица заявок.
create table if not exists public.price_orders (
  id            uuid primary key default gen_random_uuid(),
  token         text not null unique default replace(gen_random_uuid()::text, '-', ''),
  cid           text unique,                         -- id нажатия у клиента: двойное нажатие не создаёт дубль
  order_no      text not null,
  created_at    timestamptz not null default now(),
  manager       text not null,
  kind          text not null check (kind in ('retail', 'opt')),
  customer_name text not null,
  city          text not null default '',
  phone         text not null,
  items         jsonb not null,                      -- [[растение, контейнер, кол-во, цена], ...]
  n_items       int not null,
  qty_total     int not null,
  total         numeric(14, 2) not null,
  price_date    text not null default '',
  status        text not null default 'new'
                check (status in ('new', 'in_work', 'agreed', 'cancelled')),
  status_at     timestamptz,
  status_by     uuid
);
create index if not exists price_orders_created_idx on public.price_orders (created_at desc);

alter table public.price_orders enable row level security;
revoke all on public.price_orders from anon, authenticated;
grant select on public.price_orders to authenticated;
grant update (status, status_at, status_by) on public.price_orders to authenticated;

drop policy if exists price_orders_staff_select on public.price_orders;
create policy price_orders_staff_select on public.price_orders
  for select to authenticated using (public.dg_staff_role() is not null);
drop policy if exists price_orders_staff_update on public.price_orders;
create policy price_orders_staff_update on public.price_orders
  for update to authenticated using (public.dg_staff_role() is not null)
  with check (public.dg_staff_role() is not null);

-- 3. Клиент отправляет заявку (без входа). Сумму считает база, а не страница.
create or replace function public.dg_order_submit(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_items jsonb := p -> 'i';
  v_n int; v_q int; v_t numeric; v_bad int;
  v_ph text := regexp_replace(coalesce(p #>> '{c,ph}', ''), '\D', '', 'g');
  r record;
begin
  if octet_length(p::text) > 400000 then raise exception 'too_big'; end if;
  if coalesce(p ->> 'm', '') not in ('Наталья', 'Василина') then raise exception 'bad_manager'; end if;
  if coalesce(p ->> 'k', '') not in ('retail', 'opt') then raise exception 'bad_kind'; end if;
  if length(trim(coalesce(p #>> '{c,fn}', ''))) = 0 or length(v_ph) < 10 then raise exception 'bad_customer'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) not between 1 and 1500 then raise exception 'bad_items'; end if;

  select count(*) filter (where not (
           jsonb_typeof(e) = 'array' and jsonb_array_length(e) = 4
           and length(e ->> 0) between 1 and 200 and length(coalesce(e ->> 1, '')) <= 40
           and (e ->> 2) ~ '^\d{1,5}$' and (e ->> 2)::int > 0
           and (e ->> 3) ~ '^\d{1,8}(\.\d+)?$')),
         count(*), sum((e ->> 2)::numeric)::int, sum((e ->> 2)::numeric * (e ->> 3)::numeric)
    into v_bad, v_n, v_q, v_t
    from jsonb_array_elements(v_items) e;
  if v_bad > 0 then raise exception 'bad_items'; end if;

  insert into public.price_orders (cid, order_no, manager, kind, customer_name, city, phone, items, n_items, qty_total, total, price_date)
  values (left(p ->> 'cid', 64), left(coalesce(p ->> 'n', ''), 40), p ->> 'm', p ->> 'k',
          left(trim(p #>> '{c,fn}'), 200), left(trim(coalesce(p #>> '{c,ct}', '')), 120), left(trim(p #>> '{c,ph}'), 40),
          v_items, v_n, v_q, v_t, left(coalesce(p ->> 'pd', ''), 40))
  on conflict (cid) do nothing;

  select token, order_no, total, n_items into r from public.price_orders where cid = left(p ->> 'cid', 64);
  return jsonb_build_object('t', r.token, 'n', r.order_no, 'tot', r.total, 'cnt', r.n_items);
end $$;
revoke all on function public.dg_order_submit(jsonb) from public;
grant execute on function public.dg_order_submit(jsonb) to anon, authenticated;

-- 4. Открыть заявку по секретной ссылке (клиент и менеджер).
create or replace function public.dg_order_get(t text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'n', order_no, 'd', to_char(created_at at time zone 'Asia/Almaty', 'DD.MM.YYYY HH24:MI'),
    'm', manager, 'k', kind, 'c', jsonb_build_object('fn', customer_name, 'ct', city, 'ph', phone),
    'i', items, 'cnt', n_items, 'qty', qty_total, 'tot', total, 'pd', price_date, 'st', status)
  from public.price_orders where token = t and length(t) = 32
$$;
revoke all on function public.dg_order_get(text) from public;
grant execute on function public.dg_order_get(text) to anon, authenticated;

select 'Заявки с прайса v1 — OK' as result;
