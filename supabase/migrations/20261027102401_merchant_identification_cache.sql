-- One durable identification per owner/merchant, shared by every device and
-- every agent phase. External HTTP calls happen outside database transactions.
create table public.merchant_identifications (
  user_id uuid not null references auth.users(id) on delete cascade,
  merchant text not null check (length(merchant) between 1 and 200),
  state text not null check (state in ('processing','resolved','unresolved','error')),
  result jsonb not null default '{}'::jsonb
    check (jsonb_typeof(result) = 'object' and octet_length(result::text) <= 4096),
  lease_token uuid,
  retry_after timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, merchant)
);
create table public.merchant_lookup_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  month_start date not null,
  attempts integer not null default 0 check (attempts between 0 and 900),
  usage_day date not null,
  day_attempts integer not null default 0 check (day_attempts between 0 and 100),
  primary key (user_id, month_start)
);
alter table public.merchant_identifications enable row level security;
alter table public.merchant_lookup_usage enable row level security;
create policy own_merchant_identifications on public.merchant_identifications
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
create policy own_merchant_lookup_usage on public.merchant_lookup_usage
  for all to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.merchant_identifications, public.merchant_lookup_usage from anon;
grant select, insert, update on public.merchant_identifications, public.merchant_lookup_usage to authenticated;

create function public.claim_merchant_lookup(p_merchant text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  today date := (now() at time zone 'UTC')::date;
  month_key date := date_trunc('month', now() at time zone 'UTC')::date;
  cached public.merchant_identifications%rowtype;
  quota public.merchant_lookup_usage%rowtype;
  lease uuid := gen_random_uuid();
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_merchant is null or length(p_merchant) not between 1 and 200 then
    raise exception 'Invalid merchant' using errcode = '22023';
  end if;
  select * into cached from public.merchant_identifications
    where user_id = owner_id and merchant = p_merchant;
  if found and cached.state = 'resolved' then
    return jsonb_build_object('status','cached','result',cached.result);
  end if;
  -- Serialize new work for this owner across processes/tabs/devices.
  insert into public.merchant_lookup_usage(user_id,month_start,usage_day)
    values(owner_id,month_key,today) on conflict do nothing;
  select * into quota from public.merchant_lookup_usage
    where user_id = owner_id and month_start = month_key for update;
  select * into cached from public.merchant_identifications
    where user_id = owner_id and merchant = p_merchant for update;
  if found then
    if cached.state = 'resolved' then
      return jsonb_build_object('status','cached','result',cached.result);
    elsif cached.retry_after > now() then
      return jsonb_build_object('status','deferred');
    end if;
  end if;
  if quota.attempts >= 900 or (quota.usage_day = today and quota.day_attempts >= 100) then
    return jsonb_build_object('status','quota');
  end if;
  update public.merchant_lookup_usage set attempts = attempts + 1,
    day_attempts = case when usage_day = today then day_attempts + 1 else 1 end,
    usage_day = today where user_id = owner_id and month_start = month_key;
  insert into public.merchant_identifications(user_id,merchant,state,lease_token,retry_after)
    values(owner_id,p_merchant,'processing',lease,now() + interval '15 minutes')
    on conflict(user_id,merchant) do update set state='processing',lease_token=lease,
      retry_after=now() + interval '15 minutes',updated_at=now();
  return jsonb_build_object('status','claimed','lease_token',lease);
end;
$$;

create function public.finish_merchant_lookup(
  p_merchant text, p_lease_token uuid, p_result jsonb, p_state text
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare changed integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_state not in ('resolved','unresolved','error') then raise exception 'Invalid state'; end if;
  if p_state = 'resolved' and (
    coalesce(p_result->>'category','') = '' or
    coalesce(p_result->>'source_url','') !~ '^https?://' or
    coalesce((p_result->>'confidence')::numeric,0) < 0.9
  ) then raise exception 'Verified identification required'; end if;
  update public.merchant_identifications set result=p_result,state=p_state,
    lease_token=null,updated_at=now(),
    retry_after=case when p_state='resolved' then null
                    when p_state='error' then now()+interval '1 day'
                    else now()+interval '7 days' end
    where user_id=auth.uid() and merchant=p_merchant
      and state='processing' and lease_token=p_lease_token;
  get diagnostics changed = row_count;
  return changed=1;
end;
$$;
revoke all on function public.claim_merchant_lookup(text) from public,anon;
revoke all on function public.finish_merchant_lookup(text,uuid,jsonb,text) from public,anon;
grant execute on function public.claim_merchant_lookup(text) to authenticated;
grant execute on function public.finish_merchant_lookup(text,uuid,jsonb,text) to authenticated;
