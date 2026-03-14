-- user_quotas: Free/Pro 회수 제한 테이블
create table if not exists user_quotas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade unique not null,
  plan text not null default 'free',
  quotas jsonb not null default '{
    "analyze": {"limit": 5, "used": 0},
    "compare": {"limit": 2, "used": 0},
    "library": {"limit": 20, "used": 0},
    "radar": {"limit": 1, "used": 0},
    "guide": {"limit": 3, "used": 0},
    "script": {"limit": 1, "used": 0}
  }'::jsonb,
  reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month'),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table user_quotas enable row level security;

create policy "Users can read own quota"
  on user_quotas for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Service role full access"
  on user_quotas for all
  to service_role
  using (true)
  with check (true);

-- Index
create index if not exists idx_user_quotas_user_id on user_quotas(user_id);
