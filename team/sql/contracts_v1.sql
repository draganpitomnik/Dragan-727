-- DRAGAN Manager · Договоры поставки · v1 (04.11.2026)
-- Запускать один раз в Supabase проекта dragan-manager: SQL Editor → вставить всё → Run.
-- Повторный запуск безопасен. Ничего существующего не удаляет и не меняет.
-- Ожидаемый результат в конце: строка «Договоры v1 — OK».

-- 1. Кто сотрудник: та же таблица staff_access, что и у входа в кабинет.
create or replace function public.dg_staff_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.staff_access
  where user_id = auth.uid() and active and role in ('admin', 'manager')
  limit 1
$$;
revoke all on function public.dg_staff_role() from public, anon;
grant execute on function public.dg_staff_role() to authenticated;

-- 2. Счётчики номеров: отдельно для ТОО и ИП, по годам.
create table if not exists public.contract_counters (
  seller text not null check (seller in ('too', 'ip')),
  year   int  not null,
  last   int  not null default 0,
  primary key (seller, year)
);
alter table public.contract_counters enable row level security;
revoke all on public.contract_counters from anon, authenticated;

-- 3. Реестр договоров.
create table if not exists public.contracts (
  id               uuid primary key default gen_random_uuid(),
  seller           text not null check (seller in ('too', 'ip')),
  year             int  not null,
  seq              int  not null,
  number           text not null unique,
  contract_date    date not null default (now() at time zone 'Asia/Almaty')::date,
  template_version text not null,
  order_no         text,
  buyer_name       text not null,
  total            numeric(14, 2) not null,
  payload          jsonb not null,
  status           text not null default 'registered'
                   check (status in ('registered', 'cancelled', 'annulled')),
  status_note      text,
  created_by       uuid not null default auth.uid(),
  created_at       timestamptz not null default now(),
  unique (seller, year, seq)
);
create index if not exists contracts_created_by_idx on public.contracts (created_by, created_at desc);

-- 4. Допсоглашения (ds) и подтверждения отмены (cancel).
create table if not exists public.contract_docs (
  id          uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id),
  kind        text not null check (kind in ('ds', 'cancel')),
  seq         int  not null,
  number      text not null unique,
  doc_date    date not null default (now() at time zone 'Asia/Almaty')::date,
  payload     jsonb not null,
  created_by  uuid not null default auth.uid(),
  created_at  timestamptz not null default now(),
  unique (contract_id, kind, seq)
);

-- 5. Доступ: читать — свои (менеджер) или все (админ). Писать — только через функции ниже.
alter table public.contracts enable row level security;
alter table public.contract_docs enable row level security;
revoke all on public.contracts, public.contract_docs from anon, authenticated;
grant select on public.contracts, public.contract_docs to authenticated;

drop policy if exists contracts_read on public.contracts;
create policy contracts_read on public.contracts for select to authenticated
  using (public.dg_staff_role() = 'admin'
         or (public.dg_staff_role() = 'manager' and created_by = auth.uid()));

drop policy if exists contract_docs_read on public.contract_docs;
create policy contract_docs_read on public.contract_docs for select to authenticated
  using (exists (select 1 from public.contracts c where c.id = contract_id));

-- 6. Номер и содержание после регистрации не меняются никем. Удаление запрещено.
create or replace function public.dg_contracts_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'Удаление договоров и документов запрещено. Используйте аннулирование.';
  end if;
  if tg_table_name = 'contracts' then
    if new.number <> old.number or new.seq <> old.seq or new.year <> old.year
       or new.seller <> old.seller or new.payload <> old.payload
       or new.contract_date <> old.contract_date or new.total <> old.total then
      raise exception 'Номер и содержание зарегистрированного договора менять нельзя.';
    end if;
  else
    if new.number <> old.number or new.payload <> old.payload or new.seq <> old.seq then
      raise exception 'Номер и содержание зарегистрированного документа менять нельзя.';
    end if;
  end if;
  return new;
end $$;

drop trigger if exists contracts_guard on public.contracts;
create trigger contracts_guard before update or delete on public.contracts
  for each row execute function public.dg_contracts_guard();
drop trigger if exists contract_docs_guard on public.contract_docs;
create trigger contract_docs_guard before update or delete on public.contract_docs
  for each row execute function public.dg_contracts_guard();

-- 7. Регистрация договора: сервер выдаёт следующий номер (DAS-2026-0001 / IP-2026-0001).
create or replace function public.dg_register_contract(
  p_seller text, p_template_version text, p_order_no text,
  p_buyer_name text, p_total numeric, p_payload jsonb)
returns table (id uuid, number text, contract_date date)
language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.dg_staff_role();
  v_year int  := extract(year from (now() at time zone 'Asia/Almaty'))::int;
  v_seq  int;
  v_num  text;
begin
  if v_role is null then raise exception 'Нет доступа'; end if;
  if p_seller not in ('too', 'ip') then raise exception 'Неизвестный продавец'; end if;
  if coalesce(trim(p_buyer_name), '') = '' or p_total is null or p_total <= 0 then
    raise exception 'Нет покупателя или суммы';
  end if;
  if jsonb_array_length(coalesce(p_payload -> 'items', '[]'::jsonb)) = 0 then
    raise exception 'В спецификации нет позиций';
  end if;

  insert into public.contract_counters as c (seller, year, last)
  values (p_seller, v_year, 1)
  on conflict (seller, year) do update set last = c.last + 1
  returning c.last into v_seq;

  v_num := case p_seller when 'too' then 'DAS' else 'IP' end
           || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');

  return query
  insert into public.contracts as k
    (seller, year, seq, number, template_version, order_no, buyer_name, total, payload)
  values (p_seller, v_year, v_seq, v_num, p_template_version, p_order_no,
          trim(p_buyer_name), p_total, p_payload)
  returning k.id, k.number, k.contract_date;
end $$;

-- 8. Допсоглашение / отмена: номер договора + -ДС1, -ДС2 … или -О1 …
create or replace function public.dg_register_contract_doc(
  p_contract uuid, p_kind text, p_payload jsonb)
returns table (id uuid, number text, doc_date date)
language plpgsql security definer set search_path = public as $$
declare
  v_role text := public.dg_staff_role();
  v_c    public.contracts%rowtype;
  v_seq  int;
  v_num  text;
begin
  if v_role is null then raise exception 'Нет доступа'; end if;
  if p_kind not in ('ds', 'cancel') then raise exception 'Неизвестный вид документа'; end if;

  select * into v_c from public.contracts where contracts.id = p_contract for update;
  if not found then raise exception 'Договор не найден'; end if;
  if v_role <> 'admin' and v_c.created_by <> auth.uid() then raise exception 'Нет доступа к договору'; end if;
  if v_c.status <> 'registered' then raise exception 'Договор отменён или аннулирован'; end if;

  select coalesce(max(d.seq), 0) + 1 into v_seq
  from public.contract_docs d where d.contract_id = p_contract and d.kind = p_kind;
  v_num := v_c.number || case p_kind when 'ds' then '-ДС' else '-О' end || v_seq;

  if p_kind = 'cancel' and p_payload ->> 'scope' = 'full' then
    update public.contracts set status = 'cancelled', status_note = v_num where contracts.id = p_contract;
  end if;

  return query
  insert into public.contract_docs as d (contract_id, kind, seq, number, payload)
  values (p_contract, p_kind, v_seq, v_num, p_payload)
  returning d.id, d.number, d.doc_date;
end $$;

-- 9. Аннулирование ошибочной регистрации (номер остаётся занятым, запись — в реестре).
create or replace function public.dg_annul_contract(p_contract uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare v_role text := public.dg_staff_role(); v_c public.contracts%rowtype;
begin
  if v_role is null then raise exception 'Нет доступа'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'Укажите причину аннулирования'; end if;
  select * into v_c from public.contracts where id = p_contract for update;
  if not found then raise exception 'Договор не найден'; end if;
  if v_role <> 'admin' and v_c.created_by <> auth.uid() then raise exception 'Нет доступа к договору'; end if;
  if v_c.status <> 'registered' then raise exception 'Договор уже отменён или аннулирован'; end if;
  update public.contracts set status = 'annulled', status_note = trim(p_reason) where id = p_contract;
end $$;

revoke all on function public.dg_register_contract(text, text, text, text, numeric, jsonb) from public, anon;
revoke all on function public.dg_register_contract_doc(uuid, text, jsonb) from public, anon;
revoke all on function public.dg_annul_contract(uuid, text) from public, anon;
grant execute on function public.dg_register_contract(text, text, text, text, numeric, jsonb) to authenticated;
grant execute on function public.dg_register_contract_doc(uuid, text, jsonb) to authenticated;
grant execute on function public.dg_annul_contract(uuid, text) to authenticated;

-- 10. Самопроверка.
do $$
begin
  if to_regclass('public.staff_access') is null then
    raise exception 'Нет таблицы staff_access — это не проект dragan-manager';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'contracts_guard') then
    raise exception 'Не создан запрет изменения договоров';
  end if;
end $$;
select 'Договоры v1 — OK' as result;
