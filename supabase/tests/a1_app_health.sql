-- A1: служебная функция проверки связи доступна анонимной роли.
begin;
set local role anon;
do $$
begin
  if (public.app_health() ->> 'server_time') is null then
    raise exception 'app_health() не вернул server_time';
  end if;
end;
$$;
rollback;
\echo 'a1_app_health: OK'
