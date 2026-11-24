create table if not exists public.bookings (
  booking_reference text primary key,
  match_id text not null,
  category_id text not null,
  customer_name text not null,
  customer_email text not null,
  quantity integer not null check (quantity between 1 and 6),
  unit_price numeric(10, 2) not null check (unit_price >= 0),
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  created_at timestamptz not null default now()
);

alter table public.bookings
  add column if not exists customer_name text,
  add column if not exists customer_email text,
  add column if not exists unit_price numeric(10, 2);

create unique index if not exists bookings_booking_reference_key
  on public.bookings (booking_reference);

alter table public.bookings enable row level security;
revoke all on table public.bookings from public, anon, authenticated;

create or replace function public.create_ticket_booking(
  p_booking_reference text,
  p_match_id text,
  p_ticket_category_id text,
  p_customer_name text,
  p_customer_email text,
  p_quantity integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match_id public.ticket_categories.match_id%type;
  v_category_id public.ticket_categories.id%type;
  v_available_seats integer;
  v_price numeric(10, 2);
begin
  if p_booking_reference is null or btrim(p_booking_reference) = ''
    or p_match_id is null or p_ticket_category_id is null
    or p_customer_name is null or length(btrim(p_customer_name)) < 2
    or p_customer_email is null or btrim(p_customer_email) = ''
    or p_quantity is null or p_quantity < 1 or p_quantity > 6 then
    raise exception 'Invalid booking details.';
  end if;

  select category.match_id, category.id, category.available_seats, category.price
    into v_match_id, v_category_id, v_available_seats, v_price
    from public.ticket_categories as category
    where category.id::text = p_ticket_category_id
      and category.match_id::text = p_match_id
    for update;

  if not found then
    raise exception 'The selected ticket category is unavailable.';
  end if;

  if exists (
    select 1 from public.bookings
    where booking_reference = p_booking_reference
  ) then
    return jsonb_build_object('booking_reference', p_booking_reference);
  end if;

  if v_available_seats is null or v_price is null or v_available_seats < p_quantity then
    raise exception 'Not enough seats are available for this category.';
  end if;

  update public.ticket_categories
    set available_seats = v_available_seats - p_quantity
    where id = v_category_id;

  insert into public.bookings (
    booking_reference,
    match_id,
    category_id,
    customer_name,
    customer_email,
    quantity,
    unit_price,
    total_amount
  ) values (
    p_booking_reference,
    v_match_id,
    v_category_id,
    btrim(p_customer_name),
    btrim(p_customer_email),
    p_quantity,
    v_price,
    v_price * p_quantity
  );

  return jsonb_build_object('booking_reference', p_booking_reference);
end;
$$;

revoke all on function public.create_ticket_booking(text, text, text, text, text, integer) from public;
grant execute on function public.create_ticket_booking(text, text, text, text, text, integer) to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'matches'
  ) then
    execute 'alter publication supabase_realtime add table public.matches';
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'ticket_categories'
  ) then
    execute 'alter publication supabase_realtime add table public.ticket_categories';
  end if;
end;
$$;
