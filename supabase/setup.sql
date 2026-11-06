-- KinStack Finance schema. These tables are separate from the earlier generic
-- finance starter tables in this project and can be safely applied alongside them.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table if not exists public.finance_workspaces (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_members (
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('superadmin', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id),
  unique (workspace_id, email)
);

create table if not exists public.finance_records (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  kind text not null check (kind in ('client', 'invoice', 'quotation', 'recurring')),
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists finance_records_workspace_kind_idx on public.finance_records(workspace_id, kind);

create table if not exists public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  date date not null,
  type text not null check (type in ('income', 'expense')),
  amount bigint not null check (amount > 0),
  party text not null,
  category text not null,
  description text not null default '',
  method text not null default 'Bank transfer',
  reference text not null default '',
  currency text not null check (currency in ('INR', 'AED')),
  client_id uuid,
  document_id uuid,
  recurring_id uuid,
  period text,
  created_at timestamptz not null default now(),
  foreign key (client_id) references public.finance_records(id) on delete restrict,
  foreign key (document_id) references public.finance_records(id) on delete restrict,
  foreign key (recurring_id) references public.finance_records(id) on delete restrict
);
create index if not exists finance_transactions_workspace_date_idx on public.finance_transactions(workspace_id, date desc);
create unique index if not exists finance_recurring_payment_unique
  on public.finance_transactions(workspace_id, recurring_id, period)
  where recurring_id is not null and period is not null;

create table if not exists public.finance_receipts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete cascade,
  transaction_id uuid not null references public.finance_transactions(id) on delete restrict,
  name text not null,
  mime text not null,
  size bigint not null check (size > 0 and size <= 10485760),
  object_path text not null unique,
  created_at timestamptz not null default now()
);

create or replace function private.has_finance_role(target_workspace uuid, allowed_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.finance_members as member
    where member.workspace_id = target_workspace
      and member.user_id = (select auth.uid())
      and (allowed_roles is null or member.role = any(allowed_roles))
  );
$$;
revoke all on function private.has_finance_role(uuid, text[]) from public, anon;
grant execute on function private.has_finance_role(uuid, text[]) to authenticated;

alter table public.finance_workspaces enable row level security;
alter table public.finance_members enable row level security;
alter table public.finance_records enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.finance_receipts enable row level security;

grant select on public.finance_workspaces, public.finance_members, public.finance_records,
  public.finance_transactions, public.finance_receipts to authenticated;
grant insert, update, delete on public.finance_members, public.finance_records,
  public.finance_transactions, public.finance_receipts to authenticated;

drop policy if exists finance_workspace_read on public.finance_workspaces;
create policy finance_workspace_read on public.finance_workspaces for select to authenticated
  using (private.has_finance_role(id));

drop policy if exists finance_members_read on public.finance_members;
create policy finance_members_read on public.finance_members for select to authenticated
  using (user_id = (select auth.uid()) or private.has_finance_role(workspace_id, array['superadmin']::text[]));
drop policy if exists finance_members_insert on public.finance_members;
create policy finance_members_insert on public.finance_members for insert to authenticated
  with check (private.has_finance_role(workspace_id, array['superadmin']::text[]));
drop policy if exists finance_members_update on public.finance_members;
create policy finance_members_update on public.finance_members for update to authenticated
  using (private.has_finance_role(workspace_id, array['superadmin']::text[]))
  with check (private.has_finance_role(workspace_id, array['superadmin']::text[]));
drop policy if exists finance_members_delete on public.finance_members;
create policy finance_members_delete on public.finance_members for delete to authenticated
  using (private.has_finance_role(workspace_id, array['superadmin']::text[]));

drop policy if exists finance_records_read on public.finance_records;
create policy finance_records_read on public.finance_records for select to authenticated
  using (private.has_finance_role(workspace_id));
drop policy if exists finance_records_insert on public.finance_records;
create policy finance_records_insert on public.finance_records for insert to authenticated
  with check (private.has_finance_role(workspace_id, array['superadmin', 'editor']::text[]));
drop policy if exists finance_records_update on public.finance_records;
create policy finance_records_update on public.finance_records for update to authenticated
  using (private.has_finance_role(workspace_id, array['superadmin', 'editor']::text[]))
  with check (private.has_finance_role(workspace_id, array['superadmin', 'editor']::text[]));
drop policy if exists finance_records_delete on public.finance_records;
create policy finance_records_delete on public.finance_records for delete to authenticated
  using (private.has_finance_role(workspace_id, array['superadmin', 'editor']::text[]));

drop policy if exists finance_transactions_read on public.finance_transactions;
create policy finance_transactions_read on public.finance_transactions for select to authenticated
  using (private.has_finance_role(workspace_id));
drop policy if exists finance_transactions_insert on public.finance_transactions;
create policy finance_transactions_insert on public.finance_transactions for insert to authenticated
  with check (private.has_finance_role(workspace_id, array['superadmin', 'editor']::text[]));
drop policy if exists finance_transactions_update on public.finance_transactions;
create policy finance_transactions_update on public.finance_transactions for update to authenticated
  using (private.has_finance_role(workspace_id, array['superadmin', 'editor']::text[]))
  with check (private.has_finance_role(workspace_id, array['superadmin', 'editor']::text[]));
drop policy if exists finance_transactions_delete on public.finance_transactions;
create policy finance_transactions_delete on public.finance_transactions for delete to authenticated
  using (private.has_finance_role(workspace_id, array['superadmin', 'editor']::text[]));

drop policy if exists finance_receipts_read on public.finance_receipts;
create policy finance_receipts_read on public.finance_receipts for select to authenticated
  using (private.has_finance_role(workspace_id));
drop policy if exists finance_receipts_insert on public.finance_receipts;
create policy finance_receipts_insert on public.finance_receipts for insert to authenticated
  with check (private.has_finance_role(workspace_id, array['superadmin', 'editor']::text[]));
drop policy if exists finance_receipts_delete on public.finance_receipts;
create policy finance_receipts_delete on public.finance_receipts for delete to authenticated
  using (private.has_finance_role(workspace_id, array['superadmin', 'editor']::text[]));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kinstack-finance-receipts', 'kinstack-finance-receipts', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

-- Bootstrap is restricted to the finance owner email already used by the
-- current KinStack workspace. The user still has to be created in Supabase Auth.
revoke insert on public.finance_workspaces from anon, authenticated;
drop policy if exists finance_workspace_bootstrap on public.finance_workspaces;

drop policy if exists finance_members_insert on public.finance_members;
create policy finance_members_insert on public.finance_members for insert to authenticated
  with check (private.has_finance_role(workspace_id, array['superadmin']::text[]));

create or replace function public.finance_assign_member(target_workspace uuid, target_email text, target_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  matched_user_id uuid;
begin
  if not private.has_finance_role(target_workspace, array['superadmin']::text[]) then
    raise exception 'Only the superadmin can manage team access.' using errcode = '42501';
  end if;
  if target_role is null or lower(target_role) not in ('superadmin', 'editor', 'viewer') or position('@' in target_email) < 2 then
    raise exception 'Choose a valid email address and viewer, editor, or superadmin.' using errcode = '22023';
  end if;
  select user_row.id into matched_user_id
    from auth.users as user_row
    where lower(user_row.email) = lower(target_email)
    limit 1;
  if matched_user_id is null then
    raise exception 'No Supabase Auth account exists for this email. Create the user in Authentication first.' using errcode = 'P0002';
  end if;
  insert into public.finance_members (workspace_id, user_id, email, role)
    values (target_workspace, matched_user_id, lower(target_email), lower(target_role))
    on conflict (workspace_id, user_id) do update
      set email = excluded.email, role = excluded.role;
end;
$$;
revoke all on function public.finance_assign_member(uuid, text, text) from public, anon;
grant execute on function public.finance_assign_member(uuid, text, text) to authenticated;

create or replace function public.finance_bootstrap_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  current_email text := lower((select auth.jwt() ->> 'email'));
  target_workspace_id uuid;
begin
  if current_user_id is null or current_email <> 'muhammedrizwinsadique@gmail.com' then
    raise exception 'Only the designated KinStack superadmin can initialize the workspace.' using errcode = '42501';
  end if;
  select id into target_workspace_id from public.finance_workspaces where slug = 'kinstack-growth-solutions';
  if target_workspace_id is not null then
    if exists (select 1 from public.finance_members where user_id = current_user_id and finance_members.workspace_id = target_workspace_id and role = 'superadmin') then
      return target_workspace_id;
    end if;
    raise exception 'The finance workspace was initialized by another account.' using errcode = '42501';
  end if;
  insert into public.finance_workspaces (slug, name, created_by)
    values ('kinstack-growth-solutions', 'KinStack Growth Solutions', current_user_id)
    returning id into target_workspace_id;
  insert into public.finance_members (workspace_id, user_id, email, role)
    values (target_workspace_id, current_user_id, current_email, 'superadmin');
  return target_workspace_id;
end;
$$;
revoke all on function public.finance_bootstrap_workspace() from public, anon;
grant execute on function public.finance_bootstrap_workspace() to authenticated;

create or replace function private.has_finance_role_text(target_workspace text, allowed_roles text[] default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.finance_members as member
    where member.workspace_id::text = target_workspace
      and member.user_id = (select auth.uid())
      and (allowed_roles is null or member.role = any(allowed_roles))
  );
$$;
revoke all on function private.has_finance_role_text(text, text[]) from public, anon;
grant execute on function private.has_finance_role_text(text, text[]) to authenticated;

drop policy if exists finance_receipts_storage_read on storage.objects;
create policy finance_receipts_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'kinstack-finance-receipts' and private.has_finance_role_text((storage.foldername(name))[1]));
drop policy if exists finance_receipts_storage_insert on storage.objects;
create policy finance_receipts_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'kinstack-finance-receipts' and private.has_finance_role_text((storage.foldername(name))[1], array['superadmin', 'editor']::text[]));
drop policy if exists finance_receipts_storage_delete on storage.objects;
create policy finance_receipts_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'kinstack-finance-receipts' and private.has_finance_role_text((storage.foldername(name))[1], array['superadmin', 'editor']::text[]));

create unique index if not exists finance_records_id_workspace_unique on public.finance_records(id, workspace_id);
create unique index if not exists finance_transactions_id_workspace_unique on public.finance_transactions(id, workspace_id);
create index if not exists finance_members_user_id_idx on public.finance_members(user_id);
create index if not exists finance_transactions_client_workspace_idx on public.finance_transactions(client_id, workspace_id);
create index if not exists finance_transactions_document_workspace_idx on public.finance_transactions(document_id, workspace_id);
create index if not exists finance_transactions_recurring_workspace_idx on public.finance_transactions(recurring_id, workspace_id);
create index if not exists finance_receipts_transaction_workspace_idx on public.finance_receipts(transaction_id, workspace_id);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'finance_transactions_client_workspace_fkey') then
    alter table public.finance_transactions add constraint finance_transactions_client_workspace_fkey
      foreign key (client_id, workspace_id) references public.finance_records(id, workspace_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_transactions_document_workspace_fkey') then
    alter table public.finance_transactions add constraint finance_transactions_document_workspace_fkey
      foreign key (document_id, workspace_id) references public.finance_records(id, workspace_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_transactions_recurring_workspace_fkey') then
    alter table public.finance_transactions add constraint finance_transactions_recurring_workspace_fkey
      foreign key (recurring_id, workspace_id) references public.finance_records(id, workspace_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'finance_receipts_transaction_workspace_fkey') then
    alter table public.finance_receipts add constraint finance_receipts_transaction_workspace_fkey
      foreign key (transaction_id, workspace_id) references public.finance_transactions(id, workspace_id);
  end if;
end $$;

-- Member profiles: existing memberships keep their access and can be named later.
alter table public.finance_members add column if not exists name text not null default '' check (char_length(name) <= 120);
alter table public.finance_members add column if not exists designation text not null default '' check (char_length(designation) <= 120);

create or replace function public.finance_assign_member_profile(
  target_workspace uuid, target_email text, target_role text,
  target_name text, target_designation text default ''
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if target_name is null or char_length(btrim(target_name)) not between 1 and 120
    or char_length(coalesce(target_designation, '')) > 120 then
    raise exception 'Enter a member name (up to 120 characters) and an optional designation (up to 120 characters).' using errcode = '22023';
  end if;
  perform public.finance_assign_member(target_workspace, target_email, target_role);
  update public.finance_members
    set name = btrim(target_name), designation = btrim(coalesce(target_designation, ''))
    where workspace_id = target_workspace and email = lower(target_email);
end;
$$;
revoke all on function public.finance_assign_member_profile(uuid, text, text, text, text) from public, anon;
grant execute on function public.finance_assign_member_profile(uuid, text, text, text, text) to authenticated;

-- Serialize membership changes so concurrent edits cannot remove every superadmin.
create or replace function private.finance_protect_superadmin()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  affected_workspace uuid;
begin
  if tg_op = 'INSERT' then affected_workspace := new.workspace_id;
  else affected_workspace := old.workspace_id;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(affected_workspace::text, 0));
  if tg_op = 'UPDATE' then
    if new.workspace_id <> old.workspace_id or new.user_id <> old.user_id then
      raise exception 'Membership identity cannot be changed.' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then
    if old.role = 'superadmin' and not exists (
      select 1 from public.finance_members
      where workspace_id = old.workspace_id and role = 'superadmin' and user_id <> old.user_id
    ) then
      raise exception 'At least one superadmin must remain in the workspace.' using errcode = '23514';
    end if;
    return old;
  elsif tg_op = 'UPDATE' then
    if old.role = 'superadmin' and new.role <> 'superadmin' and not exists (
      select 1 from public.finance_members
      where workspace_id = old.workspace_id and role = 'superadmin' and user_id <> old.user_id
    ) then
      raise exception 'At least one superadmin must remain in the workspace.' using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.finance_protect_superadmin() from public, anon, authenticated;
drop trigger if exists finance_protect_superadmin on public.finance_members;
create trigger finance_protect_superadmin before insert or update or delete
  on public.finance_members for each row execute function private.finance_protect_superadmin();
