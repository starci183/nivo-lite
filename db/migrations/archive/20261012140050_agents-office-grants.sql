-- The work engine and the command bus (be/src/modules/domain/decisions) resolve which agent instance handles an item through
-- public.resolve_installation. It is a stable invoker function, so the app_be role only needs to be allowed to call it; the
-- tables it reads already carry app_be select policies (20261012130100_app-be-grants.sql).
grant execute on function public.resolve_installation(uuid, text, uuid, uuid, uuid) to app_be;
