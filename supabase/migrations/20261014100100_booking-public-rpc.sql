-- The public booking page /b/<slug> on the database. A visitor has no account and the web app never calls the back end, so the page reads and writes through
-- three anon-callable definer functions (a server action of the web app calls them with the anon key):
--   public_booking_page    the shop, its note, address, time zone and active services (null when the slug is unknown or the page is switched off)
--   public_booking_times   the free start times of one service on one local day
--   public_booking_request a visitor's request: validated, rate limited, placed through booking_reserve; an AFTER INSERT trigger (next migrations) sends the
--                          booking to the back end job that plans the reminders and tells the customer
-- Every input is checked here (the caller is the public); answers carry codes the page turns into words, never prose.

create or replace function public.public_booking_page(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_ws uuid;
  v_note text;
  v_address text;
  v_tz text;
  v_shop text;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,40}$' then
    return null;
  end if;
  select s.workspace_id, s.public_note, s.address, s.timezone into v_ws, v_note, v_address, v_tz
    from public.booking_settings s where s.public_slug = p_slug and s.public_enabled;
  if v_ws is null then
    return null;
  end if;
  select w.name into v_shop from public.workspaces w where w.id = v_ws;
  return jsonb_build_object(
    'shop', coalesce(v_shop, ''),
    'slug', p_slug,
    'note', v_note,
    'address', v_address,
    'timezone', v_tz,
    'services', coalesce((
      select jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'description', v.description, 'durationMin', v.duration_min, 'priceVnd', v.price_vnd)
                       order by v.sort_order, v.created_at)
        from public.booking_services v where v.workspace_id = v_ws and v.active
    ), '[]'::jsonb)
  );
end $$;

create or replace function public.public_booking_times(p_slug text, p_service uuid, p_date text, p_party int, p_visitor text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid;
  v_tz text;
  v_day date;
  v_party int := least(20, greatest(1, coalesce(p_party, 1)));
  v_times jsonb;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,40}$' then
    return jsonb_build_object('times', '[]'::jsonb);
  end if;
  select s.workspace_id, s.timezone into v_ws, v_tz from public.booking_settings s where s.public_slug = p_slug and s.public_enabled;
  if v_ws is null then
    return jsonb_build_object('times', '[]'::jsonb);
  end if;
  if not public.booking_rate_hit('slots:' || left(coalesce(p_visitor, 'unknown'), 64), 60, 60) then
    return jsonb_build_object('times', '[]'::jsonb, 'limited', true);
  end if;
  if p_date is null or p_date !~ '^\d{4}-\d{2}-\d{2}$' then
    return jsonb_build_object('times', '[]'::jsonb);
  end if;
  begin
    v_day := p_date::date;
  exception when others then
    return jsonb_build_object('times', '[]'::jsonb);
  end;
  select coalesce(jsonb_agg(to_char(t.s_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') order by t.s_start), '[]'::jsonb) into v_times
    from (
      select distinct f.s_start
        from public.booking_free_slots(v_ws, p_service, v_day::timestamp at time zone v_tz, (v_day + 1)::timestamp at time zone v_tz, v_party) f
       order by f.s_start
       limit 200
    ) t;
  return jsonb_build_object('times', v_times);
end $$;

create or replace function public.public_booking_request(
  p_slug text, p_service uuid, p_start timestamptz, p_name text, p_phone text, p_email text,
  p_party int, p_note text, p_token text, p_website text, p_visitor text
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_ws uuid;
  v_auto boolean;
  v_pct int;
  v_svc record;
  v_name text := left(btrim(coalesce(p_name, '')), 120);
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_phone text;
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_party int := least(20, greatest(1, coalesce(p_party, 1)));
  v_key text;
  v_old record;
  v_check record;
  v_res uuid;
  v_id uuid;
  v_free boolean := false;
  v_deposit bigint := 0;
  v_alt jsonb := '[]'::jsonb;
  v_base jsonb;
  v_start_iso text;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9][a-z0-9-]{2,40}$' then
    return jsonb_build_object('ok', false, 'state', 'invalid', 'code', 'not_found');
  end if;
  select s.workspace_id, s.auto_confirm, s.deposit_pct into v_ws, v_auto, v_pct
    from public.booking_settings s where s.public_slug = p_slug and s.public_enabled;
  if v_ws is null then
    return jsonb_build_object('ok', false, 'state', 'invalid', 'code', 'not_found');
  end if;
  if not public.booking_rate_hit('book:' || left(coalesce(p_visitor, 'unknown'), 64), 8, 600)
     or not public.booking_rate_hit('page:' || v_ws::text, 120, 3600) then
    return jsonb_build_object('ok', false, 'state', 'failed', 'code', 'busy');
  end if;
  if btrim(coalesce(p_website, '')) <> '' then
    -- honeypot: a person never fills it; the bot is told it worked and nothing is stored
    return jsonb_build_object('ok', true, 'state', 'waiting', 'code', 'received_free', 'alternatives', '[]'::jsonb);
  end if;
  if v_name = '' then
    return jsonb_build_object('ok', false, 'state', 'invalid', 'code', 'name_required');
  end if;
  if v_digits = '' then
    v_phone := null;
  elsif left(v_digits, 1) = '0' then
    v_phone := '84' || substr(v_digits, 2);
  elsif left(v_digits, 2) <> '84' and length(v_digits) = 9 then
    v_phone := '84' || v_digits;
  else
    v_phone := v_digits;
  end if;
  if v_phone is null or length(v_phone) < 8 or length(v_phone) > 15 then
    return jsonb_build_object('ok', false, 'state', 'invalid', 'code', 'phone_invalid');
  end if;
  if p_start is null then
    return jsonb_build_object('ok', false, 'state', 'invalid', 'code', 'start_invalid');
  end if;
  select v.id, v.name, v.price_vnd, v.duration_min, v.buffer_min, v.resource_kind into v_svc
    from public.booking_services v where v.id = p_service and v.workspace_id = v_ws and v.active;
  if v_svc.id is null then
    return jsonb_build_object('ok', false, 'state', 'invalid', 'code', 'service_unavailable');
  end if;
  v_start_iso := to_char(p_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"');
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    v_email := null;
  else
    v_email := left(v_email, 120);
  end if;
  if p_token ~ '^[A-Za-z0-9-]{8,64}$' then
    v_key := 'public:' || p_token;
    select b.id, b.status, b.holds_slot into v_old from public.bookings b where b.workspace_id = v_ws and b.idempotency_key = v_key;
    if v_old.id is not null then
      return jsonb_build_object(
        'ok', true,
        'state', case when v_old.status = 'confirmed' then 'confirmed' else 'waiting' end,
        'code', case when v_old.status = 'confirmed' then 'confirmed' when v_old.holds_slot then 'received_free' else 'received_taken' end,
        'service', v_svc.name, 'start', v_start_iso, 'alternatives', '[]'::jsonb, 'bookingId', v_old.id
      );
    end if;
  end if;
  if v_svc.price_vnd is not null and v_svc.price_vnd > 0 and v_pct > 0 then
    v_deposit := round(v_svc.price_vnd * v_pct / 100.0)::bigint;
  end if;
  v_base := jsonb_build_object(
    'workspace_id', v_ws, 'customer_name', v_name, 'customer_phone', v_phone, 'customer_email', v_email, 'service_id', v_svc.id,
    'start_at', p_start, 'end_at', p_start + make_interval(mins => v_svc.duration_min),
    'block_end_at', p_start + make_interval(mins => v_svc.duration_min + v_svc.buffer_min),
    'party_size', v_party, 'source_channel', 'public_page', 'price_vnd', v_svc.price_vnd, 'deposit_vnd', v_deposit,
    'deposit_status', case when v_deposit > 0 then 'due' else 'none' end, 'note', left(btrim(coalesce(p_note, '')), 400), 'idempotency_key', v_key
  );
  begin
    select * into v_check from public.booking_check_slot(v_ws, v_svc.id, p_start, v_party);
    if v_check.ok then
      v_id := public.booking_reserve(
        v_base || jsonb_build_object('resource_id', v_check.resource, 'status', case when v_auto then 'confirmed' else 'requested' end, 'holds_slot', true, 'conflict_note', '')
      );
      v_free := v_id is not null;
    end if;
    if not v_free then
      -- taken or outside the plan: the request is parked on the first resource that fits and waits for the owner, holding nothing
      select r.id into v_res from public.booking_resources r
       where r.workspace_id = v_ws and r.active and (v_svc.resource_kind is null or r.kind = v_svc.resource_kind)
       order by r.sort_order, r.created_at limit 1;
      if v_res is null then
        return jsonb_build_object('ok', false, 'state', 'failed', 'code', 'no_resource', 'service', v_svc.name, 'start', v_start_iso, 'alternatives', '[]'::jsonb);
      end if;
      v_id := public.booking_reserve(
        v_base || jsonb_build_object('resource_id', v_res, 'status', 'requested', 'holds_slot', false,
                                     'conflict_note', case when v_check.ok then 'full' else coalesce(v_check.why, 'full') end)
      );
    end if;
  exception when unique_violation then
    -- the same form token arrived twice at once: the first one won, answer from it
    select b.id, b.status, b.holds_slot into v_old from public.bookings b where b.workspace_id = v_ws and b.idempotency_key = v_key;
    return jsonb_build_object(
      'ok', true,
      'state', case when v_old.status = 'confirmed' then 'confirmed' else 'waiting' end,
      'code', case when v_old.status = 'confirmed' then 'confirmed' when v_old.holds_slot then 'received_free' else 'received_taken' end,
      'service', v_svc.name, 'start', v_start_iso, 'alternatives', '[]'::jsonb, 'bookingId', v_old.id
    );
  end;
  if not v_free then
    select coalesce(jsonb_agg(to_char(t.s_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') order by t.s_start), '[]'::jsonb) into v_alt
      from (
        select d.s_start
          from (select distinct f.s_start from public.booking_free_slots(v_ws, v_svc.id, p_start - interval '84 hours', p_start + interval '7 days', v_party) f) d
         order by abs(extract(epoch from d.s_start - p_start)), d.s_start
         limit 3
      ) t;
  end if;
  return jsonb_build_object(
    'ok', true,
    'state', case when v_free and v_auto then 'confirmed' else 'waiting' end,
    'code', case when not v_free then 'received_taken' when v_auto then 'confirmed' else 'received_free' end,
    'service', v_svc.name, 'start', v_start_iso, 'alternatives', v_alt, 'bookingId', v_id
  );
end $$;

revoke all on function public.public_booking_page(text) from public;
revoke all on function public.public_booking_times(text, uuid, text, int, text) from public;
revoke all on function public.public_booking_request(text, uuid, timestamptz, text, text, text, int, text, text, text, text) from public;
grant execute on function public.public_booking_page(text) to anon, authenticated;
grant execute on function public.public_booking_times(text, uuid, text, int, text) to anon, authenticated;
grant execute on function public.public_booking_request(text, uuid, timestamptz, text, text, text, int, text, text, text, text) to anon, authenticated;
