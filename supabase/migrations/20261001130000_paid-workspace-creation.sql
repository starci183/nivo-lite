-- Workspaces are created only server-side (paid onboarding via SePay, or the local demo with the service role):
-- a signed-in user can no longer insert a workspace directly (that row would default to active and skip payment).
drop policy if exists workspaces_insert on public.workspaces;
