-- Workspace branding read by the console header and the Hub: a display name (falls back to workspaces.name) and a logo
-- address (app-relative path such as /brand/<file> or an https URL). Written by `cli seed-workspace profile` and owners.
alter table public.workspaces add column if not exists display_name text;
alter table public.workspaces add column if not exists logo_url text;

do $$
begin
    if not exists (select 1 from pg_constraint where conname = 'workspaces_display_name_check') then
        alter table public.workspaces add constraint workspaces_display_name_check
            check (display_name is null or char_length(display_name) between 1 and 120);
    end if;
    if not exists (select 1 from pg_constraint where conname = 'workspaces_logo_url_check') then
        alter table public.workspaces add constraint workspaces_logo_url_check
            check (logo_url is null or (char_length(logo_url) <= 2048 and (logo_url like '/%' or logo_url like 'https://%')));
    end if;
end
$$;

comment on column public.workspaces.display_name is 'Brand name shown in the console; null = workspaces.name.';
comment on column public.workspaces.logo_url is 'Brand logo: app-relative path or https URL; null = default mark.';
