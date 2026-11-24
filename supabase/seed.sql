grant select on public.teams, public.stadiums, public.matches, public.ticket_categories to anon, authenticated;

alter table public.teams enable row level security;
alter table public.stadiums enable row level security;
alter table public.matches enable row level security;
alter table public.ticket_categories enable row level security;

drop policy if exists teams_public_read on public.teams;
create policy teams_public_read on public.teams
  for select to anon, authenticated using (true);

drop policy if exists stadiums_public_read on public.stadiums;
create policy stadiums_public_read on public.stadiums
  for select to anon, authenticated using (true);

drop policy if exists matches_public_read on public.matches;
create policy matches_public_read on public.matches
  for select to anon, authenticated using (true);

drop policy if exists ticket_categories_public_read on public.ticket_categories;
create policy ticket_categories_public_read on public.ticket_categories
  for select to anon, authenticated using (true);

with team_seed (team_name, short_name, logo_url) as (
  values
    ('Chennai Super Kings', 'CSK', 'img/csk.svg'),
    ('Mumbai Indians', 'MI', 'img/mi.svg'),
    ('Royal Challengers Bengaluru', 'RCB', 'img/rcb.svg'),
    ('Kolkata Knight Riders', 'KKR', 'img/kkr.svg'),
    ('Sunrisers Hyderabad', 'SRH', 'img/srh.svg'),
    ('Rajasthan Royals', 'RR', 'img/rr.svg'),
    ('Delhi Capitals', 'DC', 'img/dc.svg'),
    ('Punjab Kings', 'PBKS', 'img/pbks.svg'),
    ('Gujarat Titans', 'GT', 'img/gt.svg'),
    ('Lucknow Super Giants', 'LSG', 'img/lsg.svg')
)
insert into public.teams (team_name, short_name, logo_url)
select seed.team_name, seed.short_name, seed.logo_url
from team_seed as seed
where not exists (
  select 1 from public.teams as team
  where team.short_name = seed.short_name
);

with stadium_seed (stadium_name, city, capacity) as (
  values
    ('M. Chinnaswamy Stadium', 'Bengaluru', 40000),
    ('Wankhede Stadium', 'Mumbai', 33000),
    ('Rajiv Gandhi International Cricket Stadium', 'Hyderabad', 55000),
    ('Sawai Mansingh Stadium', 'Jaipur', 30000),
    ('Maharaja Yadavindra Singh International Cricket Stadium', 'New Chandigarh', 38000),
    ('M. A. Chidambaram Stadium', 'Chennai', 38000),
    ('Narendra Modi Stadium', 'Ahmedabad', 132000),
    ('Eden Gardens', 'Kolkata', 68000)
)
insert into public.stadiums (stadium_name, city, capacity)
select seed.stadium_name, seed.city, seed.capacity
from stadium_seed as seed
where not exists (
  select 1 from public.stadiums as stadium
  where stadium.stadium_name = seed.stadium_name
);

with match_seed (match_number, home_short, away_short, stadium_name, match_date) as (
  values
    (1, 'RCB', 'CSK', 'M. Chinnaswamy Stadium', '2027-03-20 19:30:00+05:30'::timestamptz),
    (2, 'MI', 'KKR', 'Wankhede Stadium', '2027-03-21 19:30:00+05:30'::timestamptz),
    (3, 'SRH', 'GT', 'Rajiv Gandhi International Cricket Stadium', '2027-03-22 19:30:00+05:30'::timestamptz),
    (4, 'RR', 'DC', 'Sawai Mansingh Stadium', '2027-03-23 19:30:00+05:30'::timestamptz),
    (5, 'PBKS', 'LSG', 'Maharaja Yadavindra Singh International Cricket Stadium', '2027-03-24 19:30:00+05:30'::timestamptz),
    (6, 'CSK', 'MI', 'M. A. Chidambaram Stadium', '2027-03-25 19:30:00+05:30'::timestamptz),
    (7, 'GT', 'RCB', 'Narendra Modi Stadium', '2027-03-26 19:30:00+05:30'::timestamptz),
    (8, 'KKR', 'SRH', 'Eden Gardens', '2027-03-27 19:30:00+05:30'::timestamptz)
)
insert into public.matches (
  team1_id,
  team2_id,
  stadium_id,
  match_title,
  match_date,
  match_number,
  status
)
select
  home.id,
  away.id,
  stadium.id,
  'DEMO MATCH',
  seed.match_date,
  seed.match_number,
  'upcoming'
from match_seed as seed
join public.teams as home on home.short_name = seed.home_short
join public.teams as away on away.short_name = seed.away_short
join public.stadiums as stadium on stadium.stadium_name = seed.stadium_name
where not exists (
  select 1 from public.matches as existing_match
  where existing_match.match_number = seed.match_number
);

insert into public.ticket_categories (
  match_id,
  category_name,
  price,
  total_seats,
  available_seats
)
select
  existing_match.id,
  category_seed.category_name,
  category_seed.price,
  category_seed.total_seats,
  category_seed.total_seats
from public.matches as existing_match
cross join (
  values
    ('General Stand', 900, 1000),
    ('Premium Stand', 1800, 250),
    ('VIP Lounge', 3200, 50)
) as category_seed(category_name, price, total_seats)
where existing_match.match_title = 'DEMO MATCH'
  and not exists (
    select 1
    from public.ticket_categories as existing
    where existing.match_id = existing_match.id
      and existing.category_name = category_seed.category_name
  );
