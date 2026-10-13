-- The business type picked at onboarding (free text key: retail, services, clinic, education, other).
alter table public.workspaces add column if not exists business_type text;
