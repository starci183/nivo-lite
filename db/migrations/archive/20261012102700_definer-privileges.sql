-- Definer safety: every security definer function in public pins search_path (already true) and is no longer
-- executable by `public` or `anon` (invite_preview keeps its explicit anon grant: it backs the public invite page).
-- Trigger functions are not callable as RPC at all; triggers fire without an EXECUTE grant.

revoke execute on function public.agent_conversations_attribute_lead() from public, anon, authenticated;
revoke execute on function public.agent_conversations_fill_installation() from public, anon, authenticated;
revoke execute on function public.ai_usage_events_settle() from public, anon, authenticated;
revoke execute on function public.bookings_fill_installation() from public, anon, authenticated;
revoke execute on function public.is_owner(ws uuid) from public, anon;
revoke execute on function public.lead_flows_fill_installation() from public, anon, authenticated;
revoke execute on function public.shifts_my_profile(ws uuid) from public, anon;
revoke execute on function public.storage_ws_manager(p_name text) from public, anon;
revoke execute on function public.storage_ws_member(p_name text) from public, anon;
revoke execute on function public.work_items_fill_installation() from public, anon, authenticated;
revoke execute on function public.workspace_members_guard() from public, anon, authenticated;
revoke execute on function public.workspaces_add_owner_member() from public, anon, authenticated;
revoke execute on function public.workspaces_billing_guard() from public, anon, authenticated;
