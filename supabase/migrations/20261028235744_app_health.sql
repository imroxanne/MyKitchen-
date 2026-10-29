-- Служебная функция проверки связи с БД.
-- Используется экраном /status и workflow keep-alive (бесплатный проект
-- Supabase приостанавливается после 7 дней без обращений к БД).
-- Не читает пользовательских данных.

create or replace function public.app_health()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object('server_time', now());
$$;

revoke all on function public.app_health() from public;
grant execute on function public.app_health() to anon, authenticated;
