-- Apply after setup.sql. Amounts are integer minor units (paise / fils).
create table public.finance_loans (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.finance_workspaces(id) on delete restrict,
  borrower text not null check (char_length(btrim(borrower)) between 1 and 120),
  amount bigint not null check (amount between 1 and 1000000000000),
  currency text not null check (currency in ('INR','AED')),
  date date not null,
  due date not null check (due >= date),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now(),
  unique (id,workspace_id)
);
create index finance_loans_workspace_date_idx on public.finance_loans(workspace_id,date desc);
create table public.finance_loan_repayments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  loan_id uuid not null,
  amount bigint not null check (amount between 1 and 1000000000000),
  date date not null,
  method text not null default 'Bank transfer' check (method in ('Bank transfer','UPI','Cash','Card','Other')),
  reference text not null default '' check (char_length(reference) <= 200),
  created_at timestamptz not null default now(),
  foreign key (loan_id,workspace_id) references public.finance_loans(id,workspace_id) on delete restrict
);
create index finance_loan_repayments_loan_idx on public.finance_loan_repayments(loan_id,workspace_id);
create index finance_loan_repayments_workspace_date_idx on public.finance_loan_repayments(workspace_id,date desc);
alter table public.finance_loans enable row level security;
alter table public.finance_loan_repayments enable row level security;
grant select,insert,update,delete on public.finance_loans to authenticated;
grant select,insert,delete on public.finance_loan_repayments to authenticated;
revoke all on public.finance_loans, public.finance_loan_repayments from anon;
create policy finance_loans_read on public.finance_loans for select to authenticated using (private.has_finance_role(workspace_id));
create policy finance_loans_insert on public.finance_loans for insert to authenticated with check (private.has_finance_role(workspace_id,array['superadmin','editor']::text[]));
create policy finance_loans_update on public.finance_loans for update to authenticated using (private.has_finance_role(workspace_id,array['superadmin','editor']::text[])) with check (private.has_finance_role(workspace_id,array['superadmin','editor']::text[]));
create policy finance_loans_delete on public.finance_loans for delete to authenticated using (private.has_finance_role(workspace_id,array['superadmin','editor']::text[]));
create policy finance_loan_repayments_read on public.finance_loan_repayments for select to authenticated using (private.has_finance_role(workspace_id));
create policy finance_loan_repayments_insert on public.finance_loan_repayments for insert to authenticated with check (private.has_finance_role(workspace_id,array['superadmin','editor']::text[]));
create policy finance_loan_repayments_delete on public.finance_loan_repayments for delete to authenticated using (private.has_finance_role(workspace_id,array['superadmin','editor']::text[]));

-- Guard direct Data API writes as well as app writes. Serialize repayments per
-- loan so concurrent requests cannot repay more than its outstanding principal.
create function private.finance_guard_loan_repayment() returns trigger
language plpgsql security invoker set search_path='' as $$
declare l public.finance_loans; repaid bigint;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.loan_id::text,17));
  select * into l from public.finance_loans where id=new.loan_id and workspace_id=new.workspace_id for update;
  if not found then raise exception 'Loan not found.' using errcode='23514'; end if;
  if new.date < l.date or new.date > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'Repayment date must be between the loan date and today.' using errcode='23514';
  end if;
  select coalesce(sum(amount),0) into repaid from public.finance_loan_repayments where loan_id=l.id and workspace_id=l.workspace_id;
  if new.amount > l.amount-repaid then raise exception 'Repayment exceeds the outstanding loan balance.' using errcode='23514'; end if;
  return new;
end; $$;
revoke all on function private.finance_guard_loan_repayment() from public,anon,authenticated;
create trigger finance_guard_loan_repayment before insert on public.finance_loan_repayments for each row execute function private.finance_guard_loan_repayment();

create function private.finance_guard_loan() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.date > (now() at time zone 'Asia/Kolkata')::date then
    raise exception 'Loan date cannot be in the future.' using errcode='23514';
  end if;
  if tg_op='UPDATE' then
    if new.id<>old.id or new.workspace_id<>old.workspace_id then raise exception 'Loan identity cannot be changed.' using errcode='23514'; end if;
    if (new.amount,new.currency,new.date) is distinct from (old.amount,old.currency,old.date)
      and exists(select 1 from public.finance_loan_repayments where loan_id=old.id and workspace_id=old.workspace_id) then
      raise exception 'Amount, currency and loan date cannot change after a repayment. Correct the repayment history first.' using errcode='23514';
    end if;
  end if;
  return new;
end; $$;
revoke all on function private.finance_guard_loan() from public,anon,authenticated;
create trigger finance_guard_loan before insert or update on public.finance_loans for each row execute function private.finance_guard_loan();
