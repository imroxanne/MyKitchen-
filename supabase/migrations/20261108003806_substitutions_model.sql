-- B5. Справочник замен ингредиентов.
--
-- * Замена — пара «продукт → альтернатива» с пропорцией, областью применимости (виды блюд и
--   пояснение словами), влиянием на вкус/текстуру/технологию, обязательным предупреждением и
--   уровнем подтверждения.
-- * Безопасность замены здесь не хранится: подходит ли она конкретному пользователю, приложение
--   решает по разметке состава замены (B4) и его ограничениям — запрещённая замена не предлагается.
-- * Справочник общий: пользователь его только читает.

create table public.ingredient_substitutions (
  id bigint generated always as identity primary key,
  from_ingredient_id bigint not null references public.ingredients (id) on delete cascade,
  to_ingredient_id bigint not null references public.ingredients (id) on delete cascade,
  -- Сколько замены на 1 единицу исходного продукта; единица — to_unit или та же, что у продукта.
  ratio numeric not null check (ratio > 0 and ratio <= 10),
  to_unit text references public.units (code),
  amount_note text not null check (length(amount_note) between 1 and 200),
  -- Виды блюд, где замена работает; пусто — в любых.
  contexts text[] not null default '{}'
    check (contexts <@ array['baking', 'frying', 'boiling', 'stewing', 'cold']),
  scope_note text not null check (length(scope_note) between 1 and 300),
  effect text not null check (length(effect) between 1 and 300),
  warning text not null check (length(warning) between 1 and 300),
  -- practice — распространённая практика, не проверено приготовлением; source — по источнику;
  -- tested — проверено приготовлением.
  confidence text not null check (confidence in ('practice', 'source', 'tested')),
  check (from_ingredient_id <> to_ingredient_id),
  unique (from_ingredient_id, to_ingredient_id)
);

comment on table public.ingredient_substitutions is
  'Замены ингредиентов: пропорция, применимость, влияние, предупреждение, уровень подтверждения';

create index ingredient_substitutions_to_idx on public.ingredient_substitutions (to_ingredient_id);

alter table public.ingredient_substitutions enable row level security;

create policy ingredient_substitutions_read on public.ingredient_substitutions
  for select to authenticated
  using (
    public.ingredient_visible(from_ingredient_id) and public.ingredient_visible(to_ingredient_id)
  );

revoke all on public.ingredient_substitutions from anon;
revoke insert, update, delete, truncate on public.ingredient_substitutions from authenticated;
