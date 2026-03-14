-- user_activity_logs: 탭 클릭 등 사용자 행동 로그
create table if not exists user_activity_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb default '{}',
  result_id text,
  created_at timestamptz default now()
);

-- RLS
alter table user_activity_logs enable row level security;

create policy "Users can insert own logs"
  on user_activity_logs for insert
  to authenticated
  with check (auth.uid() = user_id or user_id is null);

create policy "Users can read own logs"
  on user_activity_logs for select
  to authenticated
  using (auth.uid() = user_id);

-- Index for querying by action type
create index if not exists idx_user_activity_logs_action on user_activity_logs(action);
create index if not exists idx_user_activity_logs_result on user_activity_logs(result_id);
