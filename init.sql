/*usersテーブルの作成*/
create table users (
  id uuid primary key,
  user_name text,
  role text default 'general'
);
/*itemsのテーブル作成*/
create table items (
  id serial primary key,
  item_name text,
  location_name text,
  location_no text,
  stock_quantity integer default 0
);
/*requestsテーブルの作成*/
create table requests (
  id serial primary key,
  item_id integer references items(id),
  user_id uuid references users(id),
  request_quantity integer,
  status text default 'pending'
);
alter table users enable row level security;
alter table items enable row level security;
alter table requests enable row level security;
/*一般ユーザーの場合itemsを変更できない（itemsを見ることはできる）*/
create policy "Users can view items"
on items
for select
using (true);
/*管理者のみitemsを変更できる。*/
create policy "Only admin can modify items"
on items
for all
using (
  exists (
    select 1 from users
    where users.id = auth.uid()
    and users.role = 'admin'
  )
);
/*全員、requestsを送ることができる。*/
create policy "Users can create requests"
on requests
for insert
with check (auth.uid() = user_id);

/*自分が申請したものは見れるようにする。*/
create policy "Users can view own requests"
on requests
for select
using (auth.uid() = user_id);

/*管理者は全requestsを見れる。*/
create policy "Admin can view all requests"
on requests
for select
using (
  exists (
    select 1 from users
    where users.id = auth.uid()
    and role = 'admin'
  )
);