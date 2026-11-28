-- DRAGAN Manager · Заявки и заказы · v2 (28.11.2026)
-- Что нового: 7 статусов заказа, согласованный состав хранится в базе, заказы «не с прайса» из кабинета,
-- выгрузка в таблицу остатков (для скрипта таблицы, по секретному ключу).
-- Запускать один раз в Supabase проекта dragan-manager: SQL Editor → вставить всё → Run. Повторный запуск безопасен.
-- Ожидаемый результат в конце: строка «Заказы v2 — OK».

-- 1. Новые поля.
alter table public.price_orders add column if not exists source       text not null default 'price';
alter table public.price_orders add column if not exists agreed       jsonb;          -- {d, cm, i:[[растение, тара, кол-во, цена прайса, цена итог, запрошено]], x:[нет в наличии]}
alter table public.price_orders add column if not exists agreed_total numeric(14, 2);
alter table public.price_orders add column if not exists agreed_at    timestamptz;
alter table public.price_orders add column if not exists agreed_by    uuid;

-- 2. Статусы: Новая · Согласована (ждёт оплаты) · Предоплата получена · Оплачено полностью · Отправлено/выдано · Отказ клиента · Отменена нами.
alter table public.price_orders drop constraint if exists price_orders_status_check;
update public.price_orders set status = 'new' where status = 'in_work';
alter table public.price_orders add constraint price_orders_status_check
  check (status in ('new', 'agreed', 'prepaid', 'paid', 'shipped', 'refused', 'cancelled'));
alter table public.price_orders drop constraint if exists price_orders_source_check;
alter table public.price_orders add constraint price_orders_source_check check (source in ('price', 'manual'));

-- 3. Секреты (ключ выгрузки для таблицы). Никому, кроме функций базы, не виден.
create table if not exists public.dg_secrets (name text primary key, value text not null);
alter table public.dg_secrets enable row level security;
revoke all on public.dg_secrets from anon, authenticated;

-- 4. Открыть заявку по ссылке: + согласованный состав.
create or replace function public.dg_order_get(t text)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'n', order_no, 'd', to_char(created_at at time zone 'Asia/Almaty', 'DD.MM.YYYY HH24:MI'),
    'm', manager, 'k', kind, 'c', jsonb_build_object('fn', customer_name, 'ct', city, 'ph', phone),
    'i', items, 'cnt', n_items, 'qty', qty_total, 'tot', total, 'pd', price_date, 'st', status,
    'src', source, 'ag', agreed, 'agt', agreed_total)
  from public.price_orders where token = t and length(t) = 32
$$;
revoke all on function public.dg_order_get(text) from public;
grant execute on function public.dg_order_get(text) to anon, authenticated;

-- 5. Менеджер сохраняет согласованный состав. Новая заявка сама становится «Согласована».
create or replace function public.dg_order_save_agreed(t text, a jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tot numeric; v_bad int; r record;
begin
  if public.dg_staff_role() is null then raise exception 'not_staff'; end if;
  if jsonb_typeof(a -> 'i') <> 'array' or jsonb_array_length(a -> 'i') not between 1 and 1500 then raise exception 'bad_items'; end if;
  select count(*) filter (where not (jsonb_typeof(e) = 'array' and jsonb_array_length(e) >= 5
           and length(e ->> 0) between 1 and 200 and (e ->> 2) ~ '^\d{1,5}$' and (e ->> 4) ~ '^\d{1,8}(\.\d+)?$')),
         sum((e ->> 2)::numeric * (e ->> 4)::numeric)
    into v_bad, v_tot from jsonb_array_elements(a -> 'i') e;
  if v_bad > 0 then raise exception 'bad_items'; end if;
  update public.price_orders
     set agreed = a, agreed_total = v_tot, agreed_at = now(), agreed_by = auth.uid(),
         status = case when status = 'new' then 'agreed' else status end,
         status_at = case when status = 'new' then now() else status_at end
   where token = t
  returning order_no, status into r;
  if not found then raise exception 'not_found'; end if;
  return jsonb_build_object('n', r.order_no, 'st', r.status, 'tot', v_tot);
end $$;
revoke all on function public.dg_order_save_agreed(text, jsonb) from public, anon;
grant execute on function public.dg_order_save_agreed(text, jsonb) to authenticated;

-- 6. Заказ «не с прайса» (звонок, WhatsApp, площадка) — из кабинета.
create or replace function public.dg_order_create_manual(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_items jsonb := p -> 'i'; v_n int; v_q int; v_t numeric; v_bad int; r record;
  v_ph text := regexp_replace(coalesce(p #>> '{c,ph}', ''), '\D', '', 'g');
  v_no text;
begin
  if public.dg_staff_role() is null then raise exception 'not_staff'; end if;
  if coalesce(p ->> 'm', '') not in ('Наталья', 'Василина') then raise exception 'bad_manager'; end if;
  if coalesce(p ->> 'k', '') not in ('retail', 'opt') then raise exception 'bad_kind'; end if;
  if length(trim(coalesce(p #>> '{c,fn}', ''))) = 0 then raise exception 'bad_customer'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) not between 1 and 1500 then raise exception 'bad_items'; end if;
  select count(*) filter (where not (jsonb_typeof(e) = 'array' and jsonb_array_length(e) = 4
           and length(e ->> 0) between 1 and 200 and (e ->> 2) ~ '^\d{1,5}$' and (e ->> 2)::int > 0
           and (e ->> 3) ~ '^\d{1,8}(\.\d+)?$')),
         count(*), sum((e ->> 2)::numeric)::int, sum((e ->> 2)::numeric * (e ->> 3)::numeric)
    into v_bad, v_n, v_q, v_t from jsonb_array_elements(v_items) e;
  if v_bad > 0 then raise exception 'bad_items'; end if;
  v_no := case p ->> 'm' when 'Наталья' then 'N-' else 'V-' end || to_char(now() at time zone 'Asia/Almaty', 'DDMMYY-HH24MISS');
  insert into public.price_orders (cid, order_no, manager, kind, customer_name, city, phone, items, n_items, qty_total, total, source)
  values (left(p ->> 'cid', 64), v_no, p ->> 'm', p ->> 'k', left(trim(p #>> '{c,fn}'), 200),
          left(trim(coalesce(p #>> '{c,ct}', '')), 120), left(trim(coalesce(p #>> '{c,ph}', '')), 40),
          v_items, v_n, v_q, v_t, 'manual')
  on conflict (cid) do nothing;
  select token, order_no into r from public.price_orders where cid = left(p ->> 'cid', 64);
  return jsonb_build_object('t', r.token, 'n', r.order_no);
end $$;
revoke all on function public.dg_order_create_manual(jsonb) from public, anon;
grant execute on function public.dg_order_create_manual(jsonb) to authenticated;

-- 7. Выгрузка позиций для таблицы остатков (скрипт таблицы, раз в 5 минут). Только с секретным ключом.
--    Берётся согласованный состав, если он есть, иначе — заявка клиента. Отказ и отмена не выгружаются.
create or replace function public.dg_stock_export(k text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if k is null or k <> coalesce((select value from public.dg_secrets where name = 'sheet_export'), '-') then raise exception 'bad_key'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_array(e ->> 0, e ->> 1, (e ->> 2)::int, o.status, o.manager, o.order_no))
      from public.price_orders o,
           jsonb_array_elements(case when o.agreed is not null then o.agreed -> 'i' else o.items end) e
     where o.status not in ('refused', 'cancelled') and (e ->> 2)::int > 0), '[]'::jsonb);
end $$;
revoke all on function public.dg_stock_export(text) from public;
grant execute on function public.dg_stock_export(text) to anon;

select 'Заказы v2 — OK' as result;
