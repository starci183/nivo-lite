-- Grants and row level security for the lite back end role app_be on every table the back end reaches.
-- app_be is not a member: it is a login role the api connects as, so each table needs its own policies. The policies
-- are named <table>_app_be_<action>; their predicate only asserts the tenant key exists because the back end proves
-- membership itself (WorkspaceMembersService.require) before any workspace-scoped statement. Append-only logs get
-- select and insert only, catalogs the back end only reads get select, and the platform tables (queue, jobs) keep
-- the grants of be-platform; job_outbox and job_slots stay closed because only the job_* functions touch them, and
-- cron_targets and engine_workers stay out of reach.

grant usage, select on all sequences in schema public to app_be;

-- A policy written for the web roles that is not scoped `to authenticated` is evaluated for app_be too, and
-- it calls these helpers. Without execute the whole statement fails with permission denied; with it they resolve
-- to false for app_be, which has no auth.uid(), and only the app_be policies below decide.
grant execute on function public.is_manager(uuid), public.is_member(uuid), public.member_role(uuid),
    public.my_staff_id(uuid), public.owns_workspace(uuid) to app_be;

alter table public.accounting_adjustments enable row level security;
grant select, insert on table public.accounting_adjustments to app_be;
drop policy if exists "accounting_adjustments_app_be_select" on public.accounting_adjustments;
create policy "accounting_adjustments_app_be_select" on public.accounting_adjustments for select to app_be using (workspace_id is not null);
drop policy if exists "accounting_adjustments_app_be_insert" on public.accounting_adjustments;
create policy "accounting_adjustments_app_be_insert" on public.accounting_adjustments for insert to app_be with check (workspace_id is not null);

alter table public.agent_access_log enable row level security;
grant select, insert on table public.agent_access_log to app_be;
drop policy if exists "agent_access_log_app_be_select" on public.agent_access_log;
create policy "agent_access_log_app_be_select" on public.agent_access_log for select to app_be using (workspace_id is not null);
drop policy if exists "agent_access_log_app_be_insert" on public.agent_access_log;
create policy "agent_access_log_app_be_insert" on public.agent_access_log for insert to app_be with check (workspace_id is not null);

alter table public.agent_connections enable row level security;
grant select, insert, update, delete on table public.agent_connections to app_be;
drop policy if exists "agent_connections_app_be_select" on public.agent_connections;
create policy "agent_connections_app_be_select" on public.agent_connections for select to app_be using (workspace_id is not null);
drop policy if exists "agent_connections_app_be_insert" on public.agent_connections;
create policy "agent_connections_app_be_insert" on public.agent_connections for insert to app_be with check (workspace_id is not null);
drop policy if exists "agent_connections_app_be_update" on public.agent_connections;
create policy "agent_connections_app_be_update" on public.agent_connections for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "agent_connections_app_be_delete" on public.agent_connections;
create policy "agent_connections_app_be_delete" on public.agent_connections for delete to app_be using (workspace_id is not null);

alter table public.agent_conversations enable row level security;
grant select, insert, update, delete on table public.agent_conversations to app_be;
drop policy if exists "agent_conversations_app_be_select" on public.agent_conversations;
create policy "agent_conversations_app_be_select" on public.agent_conversations for select to app_be using (workspace_id is not null);
drop policy if exists "agent_conversations_app_be_insert" on public.agent_conversations;
create policy "agent_conversations_app_be_insert" on public.agent_conversations for insert to app_be with check (workspace_id is not null);
drop policy if exists "agent_conversations_app_be_update" on public.agent_conversations;
create policy "agent_conversations_app_be_update" on public.agent_conversations for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "agent_conversations_app_be_delete" on public.agent_conversations;
create policy "agent_conversations_app_be_delete" on public.agent_conversations for delete to app_be using (workspace_id is not null);

alter table public.agent_messages enable row level security;
grant select, insert, update, delete on table public.agent_messages to app_be;
drop policy if exists "agent_messages_app_be_select" on public.agent_messages;
create policy "agent_messages_app_be_select" on public.agent_messages for select to app_be using (workspace_id is not null);
drop policy if exists "agent_messages_app_be_insert" on public.agent_messages;
create policy "agent_messages_app_be_insert" on public.agent_messages for insert to app_be with check (workspace_id is not null);
drop policy if exists "agent_messages_app_be_update" on public.agent_messages;
create policy "agent_messages_app_be_update" on public.agent_messages for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "agent_messages_app_be_delete" on public.agent_messages;
create policy "agent_messages_app_be_delete" on public.agent_messages for delete to app_be using (workspace_id is not null);

alter table public.agents enable row level security;
grant select, insert, update, delete on table public.agents to app_be;
drop policy if exists "agents_app_be_select" on public.agents;
create policy "agents_app_be_select" on public.agents for select to app_be using (workspace_id is not null);
drop policy if exists "agents_app_be_insert" on public.agents;
create policy "agents_app_be_insert" on public.agents for insert to app_be with check (workspace_id is not null);
drop policy if exists "agents_app_be_update" on public.agents;
create policy "agents_app_be_update" on public.agents for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "agents_app_be_delete" on public.agents;
create policy "agents_app_be_delete" on public.agents for delete to app_be using (workspace_id is not null);

alter table public.ai_generations enable row level security;
grant select, insert, update, delete on table public.ai_generations to app_be;
drop policy if exists "ai_generations_app_be_select" on public.ai_generations;
create policy "ai_generations_app_be_select" on public.ai_generations for select to app_be using (workspace_id is not null);
drop policy if exists "ai_generations_app_be_insert" on public.ai_generations;
create policy "ai_generations_app_be_insert" on public.ai_generations for insert to app_be with check (workspace_id is not null);
drop policy if exists "ai_generations_app_be_update" on public.ai_generations;
create policy "ai_generations_app_be_update" on public.ai_generations for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "ai_generations_app_be_delete" on public.ai_generations;
create policy "ai_generations_app_be_delete" on public.ai_generations for delete to app_be using (workspace_id is not null);

alter table public.ai_quota_overrides enable row level security;
grant select, insert, update, delete on table public.ai_quota_overrides to app_be;
drop policy if exists "ai_quota_overrides_app_be_select" on public.ai_quota_overrides;
create policy "ai_quota_overrides_app_be_select" on public.ai_quota_overrides for select to app_be using (workspace_id is not null);
drop policy if exists "ai_quota_overrides_app_be_insert" on public.ai_quota_overrides;
create policy "ai_quota_overrides_app_be_insert" on public.ai_quota_overrides for insert to app_be with check (workspace_id is not null);
drop policy if exists "ai_quota_overrides_app_be_update" on public.ai_quota_overrides;
create policy "ai_quota_overrides_app_be_update" on public.ai_quota_overrides for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "ai_quota_overrides_app_be_delete" on public.ai_quota_overrides;
create policy "ai_quota_overrides_app_be_delete" on public.ai_quota_overrides for delete to app_be using (workspace_id is not null);

alter table public.ai_usage_events enable row level security;
grant select, insert on table public.ai_usage_events to app_be;
drop policy if exists "ai_usage_events_app_be_select" on public.ai_usage_events;
create policy "ai_usage_events_app_be_select" on public.ai_usage_events for select to app_be using (workspace_id is not null);
drop policy if exists "ai_usage_events_app_be_insert" on public.ai_usage_events;
create policy "ai_usage_events_app_be_insert" on public.ai_usage_events for insert to app_be with check (workspace_id is not null);

alter table public.ai_usage_notices enable row level security;
grant select, insert, update, delete on table public.ai_usage_notices to app_be;
drop policy if exists "ai_usage_notices_app_be_select" on public.ai_usage_notices;
create policy "ai_usage_notices_app_be_select" on public.ai_usage_notices for select to app_be using (workspace_id is not null);
drop policy if exists "ai_usage_notices_app_be_insert" on public.ai_usage_notices;
create policy "ai_usage_notices_app_be_insert" on public.ai_usage_notices for insert to app_be with check (workspace_id is not null);
drop policy if exists "ai_usage_notices_app_be_update" on public.ai_usage_notices;
create policy "ai_usage_notices_app_be_update" on public.ai_usage_notices for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "ai_usage_notices_app_be_delete" on public.ai_usage_notices;
create policy "ai_usage_notices_app_be_delete" on public.ai_usage_notices for delete to app_be using (workspace_id is not null);

alter table public.api_rate_limits enable row level security;
grant select, insert, update, delete on table public.api_rate_limits to app_be;
drop policy if exists "api_rate_limits_app_be_select" on public.api_rate_limits;
create policy "api_rate_limits_app_be_select" on public.api_rate_limits for select to app_be using (key_id is not null);
drop policy if exists "api_rate_limits_app_be_insert" on public.api_rate_limits;
create policy "api_rate_limits_app_be_insert" on public.api_rate_limits for insert to app_be with check (key_id is not null);
drop policy if exists "api_rate_limits_app_be_update" on public.api_rate_limits;
create policy "api_rate_limits_app_be_update" on public.api_rate_limits for update to app_be using (key_id is not null) with check (key_id is not null);
drop policy if exists "api_rate_limits_app_be_delete" on public.api_rate_limits;
create policy "api_rate_limits_app_be_delete" on public.api_rate_limits for delete to app_be using (key_id is not null);

alter table public.app_errors enable row level security;
grant select, insert on table public.app_errors to app_be;
drop policy if exists "app_errors_app_be_select" on public.app_errors;
create policy "app_errors_app_be_select" on public.app_errors for select to app_be using (workspace_id is not null);
drop policy if exists "app_errors_app_be_insert" on public.app_errors;
create policy "app_errors_app_be_insert" on public.app_errors for insert to app_be with check (workspace_id is not null);

alter table public.authority enable row level security;
grant select, insert, update, delete on table public.authority to app_be;
drop policy if exists "authority_app_be_select" on public.authority;
create policy "authority_app_be_select" on public.authority for select to app_be using (workspace_id is not null);
drop policy if exists "authority_app_be_insert" on public.authority;
create policy "authority_app_be_insert" on public.authority for insert to app_be with check (workspace_id is not null);
drop policy if exists "authority_app_be_update" on public.authority;
create policy "authority_app_be_update" on public.authority for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "authority_app_be_delete" on public.authority;
create policy "authority_app_be_delete" on public.authority for delete to app_be using (workspace_id is not null);

alter table public.authority_actions enable row level security;
grant select on table public.authority_actions to app_be;
drop policy if exists "authority_actions_app_be_select" on public.authority_actions;
create policy "authority_actions_app_be_select" on public.authority_actions for select to app_be using (action is not null);

alter table public.authority_rules enable row level security;
grant select, insert, update, delete on table public.authority_rules to app_be;
drop policy if exists "authority_rules_app_be_select" on public.authority_rules;
create policy "authority_rules_app_be_select" on public.authority_rules for select to app_be using (workspace_id is not null);
drop policy if exists "authority_rules_app_be_insert" on public.authority_rules;
create policy "authority_rules_app_be_insert" on public.authority_rules for insert to app_be with check (workspace_id is not null);
drop policy if exists "authority_rules_app_be_update" on public.authority_rules;
create policy "authority_rules_app_be_update" on public.authority_rules for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "authority_rules_app_be_delete" on public.authority_rules;
create policy "authority_rules_app_be_delete" on public.authority_rules for delete to app_be using (workspace_id is not null);

alter table public.automation_pipelines enable row level security;
grant select, insert, update, delete on table public.automation_pipelines to app_be;
drop policy if exists "automation_pipelines_app_be_select" on public.automation_pipelines;
create policy "automation_pipelines_app_be_select" on public.automation_pipelines for select to app_be using (workspace_id is not null);
drop policy if exists "automation_pipelines_app_be_insert" on public.automation_pipelines;
create policy "automation_pipelines_app_be_insert" on public.automation_pipelines for insert to app_be with check (workspace_id is not null);
drop policy if exists "automation_pipelines_app_be_update" on public.automation_pipelines;
create policy "automation_pipelines_app_be_update" on public.automation_pipelines for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "automation_pipelines_app_be_delete" on public.automation_pipelines;
create policy "automation_pipelines_app_be_delete" on public.automation_pipelines for delete to app_be using (workspace_id is not null);

alter table public.automation_runs enable row level security;
grant select, insert, update, delete on table public.automation_runs to app_be;
drop policy if exists "automation_runs_app_be_select" on public.automation_runs;
create policy "automation_runs_app_be_select" on public.automation_runs for select to app_be using (workspace_id is not null);
drop policy if exists "automation_runs_app_be_insert" on public.automation_runs;
create policy "automation_runs_app_be_insert" on public.automation_runs for insert to app_be with check (workspace_id is not null);
drop policy if exists "automation_runs_app_be_update" on public.automation_runs;
create policy "automation_runs_app_be_update" on public.automation_runs for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "automation_runs_app_be_delete" on public.automation_runs;
create policy "automation_runs_app_be_delete" on public.automation_runs for delete to app_be using (workspace_id is not null);

alter table public.automation_templates enable row level security;
grant select, insert, update on table public.automation_templates to app_be;
drop policy if exists "automation_templates_app_be_select" on public.automation_templates;
create policy "automation_templates_app_be_select" on public.automation_templates for select to app_be using (key is not null);
drop policy if exists "automation_templates_app_be_insert" on public.automation_templates;
create policy "automation_templates_app_be_insert" on public.automation_templates for insert to app_be with check (key is not null);
drop policy if exists "automation_templates_app_be_update" on public.automation_templates;
create policy "automation_templates_app_be_update" on public.automation_templates for update to app_be using (key is not null) with check (key is not null);

alter table public.billing_events enable row level security;
grant select, insert on table public.billing_events to app_be;
drop policy if exists "billing_events_app_be_select" on public.billing_events;
create policy "billing_events_app_be_select" on public.billing_events for select to app_be using (workspace_id is not null);
drop policy if exists "billing_events_app_be_insert" on public.billing_events;
create policy "billing_events_app_be_insert" on public.billing_events for insert to app_be with check (workspace_id is not null);

alter table public.booking_exceptions enable row level security;
grant select, insert, update, delete on table public.booking_exceptions to app_be;
drop policy if exists "booking_exceptions_app_be_select" on public.booking_exceptions;
create policy "booking_exceptions_app_be_select" on public.booking_exceptions for select to app_be using (workspace_id is not null);
drop policy if exists "booking_exceptions_app_be_insert" on public.booking_exceptions;
create policy "booking_exceptions_app_be_insert" on public.booking_exceptions for insert to app_be with check (workspace_id is not null);
drop policy if exists "booking_exceptions_app_be_update" on public.booking_exceptions;
create policy "booking_exceptions_app_be_update" on public.booking_exceptions for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "booking_exceptions_app_be_delete" on public.booking_exceptions;
create policy "booking_exceptions_app_be_delete" on public.booking_exceptions for delete to app_be using (workspace_id is not null);

alter table public.booking_hours enable row level security;
grant select, insert, update, delete on table public.booking_hours to app_be;
drop policy if exists "booking_hours_app_be_select" on public.booking_hours;
create policy "booking_hours_app_be_select" on public.booking_hours for select to app_be using (workspace_id is not null);
drop policy if exists "booking_hours_app_be_insert" on public.booking_hours;
create policy "booking_hours_app_be_insert" on public.booking_hours for insert to app_be with check (workspace_id is not null);
drop policy if exists "booking_hours_app_be_update" on public.booking_hours;
create policy "booking_hours_app_be_update" on public.booking_hours for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "booking_hours_app_be_delete" on public.booking_hours;
create policy "booking_hours_app_be_delete" on public.booking_hours for delete to app_be using (workspace_id is not null);

alter table public.booking_rate enable row level security;
grant select, insert, update, delete on table public.booking_rate to app_be;
drop policy if exists "booking_rate_app_be_select" on public.booking_rate;
create policy "booking_rate_app_be_select" on public.booking_rate for select to app_be using (key is not null);
drop policy if exists "booking_rate_app_be_insert" on public.booking_rate;
create policy "booking_rate_app_be_insert" on public.booking_rate for insert to app_be with check (key is not null);
drop policy if exists "booking_rate_app_be_update" on public.booking_rate;
create policy "booking_rate_app_be_update" on public.booking_rate for update to app_be using (key is not null) with check (key is not null);
drop policy if exists "booking_rate_app_be_delete" on public.booking_rate;
create policy "booking_rate_app_be_delete" on public.booking_rate for delete to app_be using (key is not null);

alter table public.booking_reminders enable row level security;
grant select, insert, update, delete on table public.booking_reminders to app_be;
drop policy if exists "booking_reminders_app_be_select" on public.booking_reminders;
create policy "booking_reminders_app_be_select" on public.booking_reminders for select to app_be using (workspace_id is not null);
drop policy if exists "booking_reminders_app_be_insert" on public.booking_reminders;
create policy "booking_reminders_app_be_insert" on public.booking_reminders for insert to app_be with check (workspace_id is not null);
drop policy if exists "booking_reminders_app_be_update" on public.booking_reminders;
create policy "booking_reminders_app_be_update" on public.booking_reminders for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "booking_reminders_app_be_delete" on public.booking_reminders;
create policy "booking_reminders_app_be_delete" on public.booking_reminders for delete to app_be using (workspace_id is not null);

alter table public.booking_resources enable row level security;
grant select, insert, update, delete on table public.booking_resources to app_be;
drop policy if exists "booking_resources_app_be_select" on public.booking_resources;
create policy "booking_resources_app_be_select" on public.booking_resources for select to app_be using (workspace_id is not null);
drop policy if exists "booking_resources_app_be_insert" on public.booking_resources;
create policy "booking_resources_app_be_insert" on public.booking_resources for insert to app_be with check (workspace_id is not null);
drop policy if exists "booking_resources_app_be_update" on public.booking_resources;
create policy "booking_resources_app_be_update" on public.booking_resources for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "booking_resources_app_be_delete" on public.booking_resources;
create policy "booking_resources_app_be_delete" on public.booking_resources for delete to app_be using (workspace_id is not null);

alter table public.booking_services enable row level security;
grant select, insert, update, delete on table public.booking_services to app_be;
drop policy if exists "booking_services_app_be_select" on public.booking_services;
create policy "booking_services_app_be_select" on public.booking_services for select to app_be using (workspace_id is not null);
drop policy if exists "booking_services_app_be_insert" on public.booking_services;
create policy "booking_services_app_be_insert" on public.booking_services for insert to app_be with check (workspace_id is not null);
drop policy if exists "booking_services_app_be_update" on public.booking_services;
create policy "booking_services_app_be_update" on public.booking_services for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "booking_services_app_be_delete" on public.booking_services;
create policy "booking_services_app_be_delete" on public.booking_services for delete to app_be using (workspace_id is not null);

alter table public.booking_settings enable row level security;
grant select, insert, update, delete on table public.booking_settings to app_be;
drop policy if exists "booking_settings_app_be_select" on public.booking_settings;
create policy "booking_settings_app_be_select" on public.booking_settings for select to app_be using (workspace_id is not null);
drop policy if exists "booking_settings_app_be_insert" on public.booking_settings;
create policy "booking_settings_app_be_insert" on public.booking_settings for insert to app_be with check (workspace_id is not null);
drop policy if exists "booking_settings_app_be_update" on public.booking_settings;
create policy "booking_settings_app_be_update" on public.booking_settings for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "booking_settings_app_be_delete" on public.booking_settings;
create policy "booking_settings_app_be_delete" on public.booking_settings for delete to app_be using (workspace_id is not null);

alter table public.booking_waitlist enable row level security;
grant select, insert, update, delete on table public.booking_waitlist to app_be;
drop policy if exists "booking_waitlist_app_be_select" on public.booking_waitlist;
create policy "booking_waitlist_app_be_select" on public.booking_waitlist for select to app_be using (workspace_id is not null);
drop policy if exists "booking_waitlist_app_be_insert" on public.booking_waitlist;
create policy "booking_waitlist_app_be_insert" on public.booking_waitlist for insert to app_be with check (workspace_id is not null);
drop policy if exists "booking_waitlist_app_be_update" on public.booking_waitlist;
create policy "booking_waitlist_app_be_update" on public.booking_waitlist for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "booking_waitlist_app_be_delete" on public.booking_waitlist;
create policy "booking_waitlist_app_be_delete" on public.booking_waitlist for delete to app_be using (workspace_id is not null);

alter table public.bookings enable row level security;
grant select, insert, update, delete on table public.bookings to app_be;
drop policy if exists "bookings_app_be_select" on public.bookings;
create policy "bookings_app_be_select" on public.bookings for select to app_be using (workspace_id is not null);
drop policy if exists "bookings_app_be_insert" on public.bookings;
create policy "bookings_app_be_insert" on public.bookings for insert to app_be with check (workspace_id is not null);
drop policy if exists "bookings_app_be_update" on public.bookings;
create policy "bookings_app_be_update" on public.bookings for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "bookings_app_be_delete" on public.bookings;
create policy "bookings_app_be_delete" on public.bookings for delete to app_be using (workspace_id is not null);

alter table public.brain_eval_cases enable row level security;
grant select, insert, update, delete on table public.brain_eval_cases to app_be;
drop policy if exists "brain_eval_cases_app_be_select" on public.brain_eval_cases;
create policy "brain_eval_cases_app_be_select" on public.brain_eval_cases for select to app_be using (workspace_id is not null);
drop policy if exists "brain_eval_cases_app_be_insert" on public.brain_eval_cases;
create policy "brain_eval_cases_app_be_insert" on public.brain_eval_cases for insert to app_be with check (workspace_id is not null);
drop policy if exists "brain_eval_cases_app_be_update" on public.brain_eval_cases;
create policy "brain_eval_cases_app_be_update" on public.brain_eval_cases for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "brain_eval_cases_app_be_delete" on public.brain_eval_cases;
create policy "brain_eval_cases_app_be_delete" on public.brain_eval_cases for delete to app_be using (workspace_id is not null);

alter table public.brain_extractions enable row level security;
grant select, insert, update, delete on table public.brain_extractions to app_be;
drop policy if exists "brain_extractions_app_be_select" on public.brain_extractions;
create policy "brain_extractions_app_be_select" on public.brain_extractions for select to app_be using (workspace_id is not null);
drop policy if exists "brain_extractions_app_be_insert" on public.brain_extractions;
create policy "brain_extractions_app_be_insert" on public.brain_extractions for insert to app_be with check (workspace_id is not null);
drop policy if exists "brain_extractions_app_be_update" on public.brain_extractions;
create policy "brain_extractions_app_be_update" on public.brain_extractions for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "brain_extractions_app_be_delete" on public.brain_extractions;
create policy "brain_extractions_app_be_delete" on public.brain_extractions for delete to app_be using (workspace_id is not null);

alter table public.brain_facts enable row level security;
grant select, insert, update, delete on table public.brain_facts to app_be;
drop policy if exists "brain_facts_app_be_select" on public.brain_facts;
create policy "brain_facts_app_be_select" on public.brain_facts for select to app_be using (workspace_id is not null);
drop policy if exists "brain_facts_app_be_insert" on public.brain_facts;
create policy "brain_facts_app_be_insert" on public.brain_facts for insert to app_be with check (workspace_id is not null);
drop policy if exists "brain_facts_app_be_update" on public.brain_facts;
create policy "brain_facts_app_be_update" on public.brain_facts for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "brain_facts_app_be_delete" on public.brain_facts;
create policy "brain_facts_app_be_delete" on public.brain_facts for delete to app_be using (workspace_id is not null);

alter table public.brain_lessons enable row level security;
grant select, insert, update, delete on table public.brain_lessons to app_be;
drop policy if exists "brain_lessons_app_be_select" on public.brain_lessons;
create policy "brain_lessons_app_be_select" on public.brain_lessons for select to app_be using (workspace_id is not null);
drop policy if exists "brain_lessons_app_be_insert" on public.brain_lessons;
create policy "brain_lessons_app_be_insert" on public.brain_lessons for insert to app_be with check (workspace_id is not null);
drop policy if exists "brain_lessons_app_be_update" on public.brain_lessons;
create policy "brain_lessons_app_be_update" on public.brain_lessons for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "brain_lessons_app_be_delete" on public.brain_lessons;
create policy "brain_lessons_app_be_delete" on public.brain_lessons for delete to app_be using (workspace_id is not null);

alter table public.brain_source_profiles enable row level security;
grant select, insert, update, delete on table public.brain_source_profiles to app_be;
drop policy if exists "brain_source_profiles_app_be_select" on public.brain_source_profiles;
create policy "brain_source_profiles_app_be_select" on public.brain_source_profiles for select to app_be using (workspace_id is not null);
drop policy if exists "brain_source_profiles_app_be_insert" on public.brain_source_profiles;
create policy "brain_source_profiles_app_be_insert" on public.brain_source_profiles for insert to app_be with check (workspace_id is not null);
drop policy if exists "brain_source_profiles_app_be_update" on public.brain_source_profiles;
create policy "brain_source_profiles_app_be_update" on public.brain_source_profiles for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "brain_source_profiles_app_be_delete" on public.brain_source_profiles;
create policy "brain_source_profiles_app_be_delete" on public.brain_source_profiles for delete to app_be using (workspace_id is not null);

alter table public.channel_receipts enable row level security;
grant select, insert on table public.channel_receipts to app_be;
drop policy if exists "channel_receipts_app_be_select" on public.channel_receipts;
create policy "channel_receipts_app_be_select" on public.channel_receipts for select to app_be using (workspace_id is not null);
drop policy if exists "channel_receipts_app_be_insert" on public.channel_receipts;
create policy "channel_receipts_app_be_insert" on public.channel_receipts for insert to app_be with check (workspace_id is not null);

alter table public.connection_secrets enable row level security;
grant select, insert, update, delete on table public.connection_secrets to app_be;
drop policy if exists "connection_secrets_app_be_select" on public.connection_secrets;
create policy "connection_secrets_app_be_select" on public.connection_secrets for select to app_be using (connection_id is not null);
drop policy if exists "connection_secrets_app_be_insert" on public.connection_secrets;
create policy "connection_secrets_app_be_insert" on public.connection_secrets for insert to app_be with check (connection_id is not null);
drop policy if exists "connection_secrets_app_be_update" on public.connection_secrets;
create policy "connection_secrets_app_be_update" on public.connection_secrets for update to app_be using (connection_id is not null) with check (connection_id is not null);
drop policy if exists "connection_secrets_app_be_delete" on public.connection_secrets;
create policy "connection_secrets_app_be_delete" on public.connection_secrets for delete to app_be using (connection_id is not null);

alter table public.connections enable row level security;
grant select, insert, update, delete on table public.connections to app_be;
drop policy if exists "connections_app_be_select" on public.connections;
create policy "connections_app_be_select" on public.connections for select to app_be using (workspace_id is not null);
drop policy if exists "connections_app_be_insert" on public.connections;
create policy "connections_app_be_insert" on public.connections for insert to app_be with check (workspace_id is not null);
drop policy if exists "connections_app_be_update" on public.connections;
create policy "connections_app_be_update" on public.connections for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "connections_app_be_delete" on public.connections;
create policy "connections_app_be_delete" on public.connections for delete to app_be using (workspace_id is not null);

alter table public.connector_interest enable row level security;
grant select, insert, update, delete on table public.connector_interest to app_be;
drop policy if exists "connector_interest_app_be_select" on public.connector_interest;
create policy "connector_interest_app_be_select" on public.connector_interest for select to app_be using (workspace_id is not null);
drop policy if exists "connector_interest_app_be_insert" on public.connector_interest;
create policy "connector_interest_app_be_insert" on public.connector_interest for insert to app_be with check (workspace_id is not null);
drop policy if exists "connector_interest_app_be_update" on public.connector_interest;
create policy "connector_interest_app_be_update" on public.connector_interest for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "connector_interest_app_be_delete" on public.connector_interest;
create policy "connector_interest_app_be_delete" on public.connector_interest for delete to app_be using (workspace_id is not null);

alter table public.content_cadence enable row level security;
grant select, insert, update, delete on table public.content_cadence to app_be;
drop policy if exists "content_cadence_app_be_select" on public.content_cadence;
create policy "content_cadence_app_be_select" on public.content_cadence for select to app_be using (workspace_id is not null);
drop policy if exists "content_cadence_app_be_insert" on public.content_cadence;
create policy "content_cadence_app_be_insert" on public.content_cadence for insert to app_be with check (workspace_id is not null);
drop policy if exists "content_cadence_app_be_update" on public.content_cadence;
create policy "content_cadence_app_be_update" on public.content_cadence for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "content_cadence_app_be_delete" on public.content_cadence;
create policy "content_cadence_app_be_delete" on public.content_cadence for delete to app_be using (workspace_id is not null);

alter table public.content_items enable row level security;
grant select, insert, update, delete on table public.content_items to app_be;
drop policy if exists "content_items_app_be_select" on public.content_items;
create policy "content_items_app_be_select" on public.content_items for select to app_be using (workspace_id is not null);
drop policy if exists "content_items_app_be_insert" on public.content_items;
create policy "content_items_app_be_insert" on public.content_items for insert to app_be with check (workspace_id is not null);
drop policy if exists "content_items_app_be_update" on public.content_items;
create policy "content_items_app_be_update" on public.content_items for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "content_items_app_be_delete" on public.content_items;
create policy "content_items_app_be_delete" on public.content_items for delete to app_be using (workspace_id is not null);

alter table public.content_pillars enable row level security;
grant select, insert, update, delete on table public.content_pillars to app_be;
drop policy if exists "content_pillars_app_be_select" on public.content_pillars;
create policy "content_pillars_app_be_select" on public.content_pillars for select to app_be using (workspace_id is not null);
drop policy if exists "content_pillars_app_be_insert" on public.content_pillars;
create policy "content_pillars_app_be_insert" on public.content_pillars for insert to app_be with check (workspace_id is not null);
drop policy if exists "content_pillars_app_be_update" on public.content_pillars;
create policy "content_pillars_app_be_update" on public.content_pillars for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "content_pillars_app_be_delete" on public.content_pillars;
create policy "content_pillars_app_be_delete" on public.content_pillars for delete to app_be using (workspace_id is not null);

alter table public.content_plans enable row level security;
grant select, insert, update, delete on table public.content_plans to app_be;
drop policy if exists "content_plans_app_be_select" on public.content_plans;
create policy "content_plans_app_be_select" on public.content_plans for select to app_be using (workspace_id is not null);
drop policy if exists "content_plans_app_be_insert" on public.content_plans;
create policy "content_plans_app_be_insert" on public.content_plans for insert to app_be with check (workspace_id is not null);
drop policy if exists "content_plans_app_be_update" on public.content_plans;
create policy "content_plans_app_be_update" on public.content_plans for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "content_plans_app_be_delete" on public.content_plans;
create policy "content_plans_app_be_delete" on public.content_plans for delete to app_be using (workspace_id is not null);

alter table public.content_settings enable row level security;
grant select, insert, update, delete on table public.content_settings to app_be;
drop policy if exists "content_settings_app_be_select" on public.content_settings;
create policy "content_settings_app_be_select" on public.content_settings for select to app_be using (workspace_id is not null);
drop policy if exists "content_settings_app_be_insert" on public.content_settings;
create policy "content_settings_app_be_insert" on public.content_settings for insert to app_be with check (workspace_id is not null);
drop policy if exists "content_settings_app_be_update" on public.content_settings;
create policy "content_settings_app_be_update" on public.content_settings for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "content_settings_app_be_delete" on public.content_settings;
create policy "content_settings_app_be_delete" on public.content_settings for delete to app_be using (workspace_id is not null);

alter table public.contracts enable row level security;
grant select, insert, update, delete on table public.contracts to app_be;
drop policy if exists "contracts_app_be_select" on public.contracts;
create policy "contracts_app_be_select" on public.contracts for select to app_be using (workspace_id is not null);
drop policy if exists "contracts_app_be_insert" on public.contracts;
create policy "contracts_app_be_insert" on public.contracts for insert to app_be with check (workspace_id is not null);
drop policy if exists "contracts_app_be_update" on public.contracts;
create policy "contracts_app_be_update" on public.contracts for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "contracts_app_be_delete" on public.contracts;
create policy "contracts_app_be_delete" on public.contracts for delete to app_be using (workspace_id is not null);

alter table public.credit_packs enable row level security;
grant select on table public.credit_packs to app_be;
drop policy if exists "credit_packs_app_be_select" on public.credit_packs;
create policy "credit_packs_app_be_select" on public.credit_packs for select to app_be using (code is not null);

alter table public.credit_topup_draws enable row level security;
grant select, insert, update, delete on table public.credit_topup_draws to app_be;
drop policy if exists "credit_topup_draws_app_be_select" on public.credit_topup_draws;
create policy "credit_topup_draws_app_be_select" on public.credit_topup_draws for select to app_be using (workspace_id is not null);
drop policy if exists "credit_topup_draws_app_be_insert" on public.credit_topup_draws;
create policy "credit_topup_draws_app_be_insert" on public.credit_topup_draws for insert to app_be with check (workspace_id is not null);
drop policy if exists "credit_topup_draws_app_be_update" on public.credit_topup_draws;
create policy "credit_topup_draws_app_be_update" on public.credit_topup_draws for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "credit_topup_draws_app_be_delete" on public.credit_topup_draws;
create policy "credit_topup_draws_app_be_delete" on public.credit_topup_draws for delete to app_be using (workspace_id is not null);

alter table public.credit_topups enable row level security;
grant select, insert, update, delete on table public.credit_topups to app_be;
drop policy if exists "credit_topups_app_be_select" on public.credit_topups;
create policy "credit_topups_app_be_select" on public.credit_topups for select to app_be using (workspace_id is not null);
drop policy if exists "credit_topups_app_be_insert" on public.credit_topups;
create policy "credit_topups_app_be_insert" on public.credit_topups for insert to app_be with check (workspace_id is not null);
drop policy if exists "credit_topups_app_be_update" on public.credit_topups;
create policy "credit_topups_app_be_update" on public.credit_topups for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "credit_topups_app_be_delete" on public.credit_topups;
create policy "credit_topups_app_be_delete" on public.credit_topups for delete to app_be using (workspace_id is not null);

alter table public.data_records enable row level security;
grant select, insert, update, delete on table public.data_records to app_be;
drop policy if exists "data_records_app_be_select" on public.data_records;
create policy "data_records_app_be_select" on public.data_records for select to app_be using (workspace_id is not null);
drop policy if exists "data_records_app_be_insert" on public.data_records;
create policy "data_records_app_be_insert" on public.data_records for insert to app_be with check (workspace_id is not null);
drop policy if exists "data_records_app_be_update" on public.data_records;
create policy "data_records_app_be_update" on public.data_records for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "data_records_app_be_delete" on public.data_records;
create policy "data_records_app_be_delete" on public.data_records for delete to app_be using (workspace_id is not null);

alter table public.data_sync_runs enable row level security;
grant select, insert, update, delete on table public.data_sync_runs to app_be;
drop policy if exists "data_sync_runs_app_be_select" on public.data_sync_runs;
create policy "data_sync_runs_app_be_select" on public.data_sync_runs for select to app_be using (workspace_id is not null);
drop policy if exists "data_sync_runs_app_be_insert" on public.data_sync_runs;
create policy "data_sync_runs_app_be_insert" on public.data_sync_runs for insert to app_be with check (workspace_id is not null);
drop policy if exists "data_sync_runs_app_be_update" on public.data_sync_runs;
create policy "data_sync_runs_app_be_update" on public.data_sync_runs for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "data_sync_runs_app_be_delete" on public.data_sync_runs;
create policy "data_sync_runs_app_be_delete" on public.data_sync_runs for delete to app_be using (workspace_id is not null);

alter table public.decisions enable row level security;
grant select, insert on table public.decisions to app_be;
drop policy if exists "decisions_app_be_select" on public.decisions;
create policy "decisions_app_be_select" on public.decisions for select to app_be using (workspace_id is not null);
drop policy if exists "decisions_app_be_insert" on public.decisions;
create policy "decisions_app_be_insert" on public.decisions for insert to app_be with check (workspace_id is not null);

alter table public.email_messages enable row level security;
grant select, insert, update, delete on table public.email_messages to app_be;
drop policy if exists "email_messages_app_be_select" on public.email_messages;
create policy "email_messages_app_be_select" on public.email_messages for select to app_be using (workspace_id is not null);
drop policy if exists "email_messages_app_be_insert" on public.email_messages;
create policy "email_messages_app_be_insert" on public.email_messages for insert to app_be with check (workspace_id is not null);
drop policy if exists "email_messages_app_be_update" on public.email_messages;
create policy "email_messages_app_be_update" on public.email_messages for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "email_messages_app_be_delete" on public.email_messages;
create policy "email_messages_app_be_delete" on public.email_messages for delete to app_be using (workspace_id is not null);

alter table public.engine_jobs enable row level security;
grant select, insert, update on table public.engine_jobs to app_be;
drop policy if exists "engine_jobs_app_be_select" on public.engine_jobs;
create policy "engine_jobs_app_be_select" on public.engine_jobs for select to app_be using (workspace_id is not null);
drop policy if exists "engine_jobs_app_be_insert" on public.engine_jobs;
create policy "engine_jobs_app_be_insert" on public.engine_jobs for insert to app_be with check (workspace_id is not null);
drop policy if exists "engine_jobs_app_be_update" on public.engine_jobs;
create policy "engine_jobs_app_be_update" on public.engine_jobs for update to app_be using (workspace_id is not null) with check (workspace_id is not null);

alter table public.events enable row level security;
grant select, insert on table public.events to app_be;
drop policy if exists "events_app_be_select" on public.events;
create policy "events_app_be_select" on public.events for select to app_be using (workspace_id is not null);
drop policy if exists "events_app_be_insert" on public.events;
create policy "events_app_be_insert" on public.events for insert to app_be with check (workspace_id is not null);

alter table public.executions enable row level security;
grant select, insert, update, delete on table public.executions to app_be;
drop policy if exists "executions_app_be_select" on public.executions;
create policy "executions_app_be_select" on public.executions for select to app_be using (workspace_id is not null);
drop policy if exists "executions_app_be_insert" on public.executions;
create policy "executions_app_be_insert" on public.executions for insert to app_be with check (workspace_id is not null);
drop policy if exists "executions_app_be_update" on public.executions;
create policy "executions_app_be_update" on public.executions for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "executions_app_be_delete" on public.executions;
create policy "executions_app_be_delete" on public.executions for delete to app_be using (workspace_id is not null);

alter table public.hiring_apply_hits enable row level security;
grant select, insert, update, delete on table public.hiring_apply_hits to app_be;
drop policy if exists "hiring_apply_hits_app_be_select" on public.hiring_apply_hits;
create policy "hiring_apply_hits_app_be_select" on public.hiring_apply_hits for select to app_be using (workspace_id is not null);
drop policy if exists "hiring_apply_hits_app_be_insert" on public.hiring_apply_hits;
create policy "hiring_apply_hits_app_be_insert" on public.hiring_apply_hits for insert to app_be with check (workspace_id is not null);
drop policy if exists "hiring_apply_hits_app_be_update" on public.hiring_apply_hits;
create policy "hiring_apply_hits_app_be_update" on public.hiring_apply_hits for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "hiring_apply_hits_app_be_delete" on public.hiring_apply_hits;
create policy "hiring_apply_hits_app_be_delete" on public.hiring_apply_hits for delete to app_be using (workspace_id is not null);

alter table public.hiring_availability enable row level security;
grant select, insert, update, delete on table public.hiring_availability to app_be;
drop policy if exists "hiring_availability_app_be_select" on public.hiring_availability;
create policy "hiring_availability_app_be_select" on public.hiring_availability for select to app_be using (workspace_id is not null);
drop policy if exists "hiring_availability_app_be_insert" on public.hiring_availability;
create policy "hiring_availability_app_be_insert" on public.hiring_availability for insert to app_be with check (workspace_id is not null);
drop policy if exists "hiring_availability_app_be_update" on public.hiring_availability;
create policy "hiring_availability_app_be_update" on public.hiring_availability for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "hiring_availability_app_be_delete" on public.hiring_availability;
create policy "hiring_availability_app_be_delete" on public.hiring_availability for delete to app_be using (workspace_id is not null);

alter table public.hiring_candidates enable row level security;
grant select, insert, update, delete on table public.hiring_candidates to app_be;
drop policy if exists "hiring_candidates_app_be_select" on public.hiring_candidates;
create policy "hiring_candidates_app_be_select" on public.hiring_candidates for select to app_be using (workspace_id is not null);
drop policy if exists "hiring_candidates_app_be_insert" on public.hiring_candidates;
create policy "hiring_candidates_app_be_insert" on public.hiring_candidates for insert to app_be with check (workspace_id is not null);
drop policy if exists "hiring_candidates_app_be_update" on public.hiring_candidates;
create policy "hiring_candidates_app_be_update" on public.hiring_candidates for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "hiring_candidates_app_be_delete" on public.hiring_candidates;
create policy "hiring_candidates_app_be_delete" on public.hiring_candidates for delete to app_be using (workspace_id is not null);

alter table public.hiring_consents enable row level security;
grant select, insert on table public.hiring_consents to app_be;
drop policy if exists "hiring_consents_app_be_select" on public.hiring_consents;
create policy "hiring_consents_app_be_select" on public.hiring_consents for select to app_be using (workspace_id is not null);
drop policy if exists "hiring_consents_app_be_insert" on public.hiring_consents;
create policy "hiring_consents_app_be_insert" on public.hiring_consents for insert to app_be with check (workspace_id is not null);

alter table public.hiring_events enable row level security;
grant select, insert on table public.hiring_events to app_be;
drop policy if exists "hiring_events_app_be_select" on public.hiring_events;
create policy "hiring_events_app_be_select" on public.hiring_events for select to app_be using (workspace_id is not null);
drop policy if exists "hiring_events_app_be_insert" on public.hiring_events;
create policy "hiring_events_app_be_insert" on public.hiring_events for insert to app_be with check (workspace_id is not null);

alter table public.hiring_interviews enable row level security;
grant select, insert, update, delete on table public.hiring_interviews to app_be;
drop policy if exists "hiring_interviews_app_be_select" on public.hiring_interviews;
create policy "hiring_interviews_app_be_select" on public.hiring_interviews for select to app_be using (workspace_id is not null);
drop policy if exists "hiring_interviews_app_be_insert" on public.hiring_interviews;
create policy "hiring_interviews_app_be_insert" on public.hiring_interviews for insert to app_be with check (workspace_id is not null);
drop policy if exists "hiring_interviews_app_be_update" on public.hiring_interviews;
create policy "hiring_interviews_app_be_update" on public.hiring_interviews for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "hiring_interviews_app_be_delete" on public.hiring_interviews;
create policy "hiring_interviews_app_be_delete" on public.hiring_interviews for delete to app_be using (workspace_id is not null);

alter table public.hiring_jobs enable row level security;
grant select, insert, update, delete on table public.hiring_jobs to app_be;
drop policy if exists "hiring_jobs_app_be_select" on public.hiring_jobs;
create policy "hiring_jobs_app_be_select" on public.hiring_jobs for select to app_be using (workspace_id is not null);
drop policy if exists "hiring_jobs_app_be_insert" on public.hiring_jobs;
create policy "hiring_jobs_app_be_insert" on public.hiring_jobs for insert to app_be with check (workspace_id is not null);
drop policy if exists "hiring_jobs_app_be_update" on public.hiring_jobs;
create policy "hiring_jobs_app_be_update" on public.hiring_jobs for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "hiring_jobs_app_be_delete" on public.hiring_jobs;
create policy "hiring_jobs_app_be_delete" on public.hiring_jobs for delete to app_be using (workspace_id is not null);

alter table public.hiring_offers enable row level security;
grant select, insert, update, delete on table public.hiring_offers to app_be;
drop policy if exists "hiring_offers_app_be_select" on public.hiring_offers;
create policy "hiring_offers_app_be_select" on public.hiring_offers for select to app_be using (workspace_id is not null);
drop policy if exists "hiring_offers_app_be_insert" on public.hiring_offers;
create policy "hiring_offers_app_be_insert" on public.hiring_offers for insert to app_be with check (workspace_id is not null);
drop policy if exists "hiring_offers_app_be_update" on public.hiring_offers;
create policy "hiring_offers_app_be_update" on public.hiring_offers for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "hiring_offers_app_be_delete" on public.hiring_offers;
create policy "hiring_offers_app_be_delete" on public.hiring_offers for delete to app_be using (workspace_id is not null);

alter table public.hiring_onboarding enable row level security;
grant select, insert, update, delete on table public.hiring_onboarding to app_be;
drop policy if exists "hiring_onboarding_app_be_select" on public.hiring_onboarding;
create policy "hiring_onboarding_app_be_select" on public.hiring_onboarding for select to app_be using (workspace_id is not null);
drop policy if exists "hiring_onboarding_app_be_insert" on public.hiring_onboarding;
create policy "hiring_onboarding_app_be_insert" on public.hiring_onboarding for insert to app_be with check (workspace_id is not null);
drop policy if exists "hiring_onboarding_app_be_update" on public.hiring_onboarding;
create policy "hiring_onboarding_app_be_update" on public.hiring_onboarding for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "hiring_onboarding_app_be_delete" on public.hiring_onboarding;
create policy "hiring_onboarding_app_be_delete" on public.hiring_onboarding for delete to app_be using (workspace_id is not null);

alter table public.hiring_retention_log enable row level security;
grant select, insert on table public.hiring_retention_log to app_be;
drop policy if exists "hiring_retention_log_app_be_select" on public.hiring_retention_log;
create policy "hiring_retention_log_app_be_select" on public.hiring_retention_log for select to app_be using (workspace_id is not null);
drop policy if exists "hiring_retention_log_app_be_insert" on public.hiring_retention_log;
create policy "hiring_retention_log_app_be_insert" on public.hiring_retention_log for insert to app_be with check (workspace_id is not null);

alter table public.hiring_settings enable row level security;
grant select, insert, update, delete on table public.hiring_settings to app_be;
drop policy if exists "hiring_settings_app_be_select" on public.hiring_settings;
create policy "hiring_settings_app_be_select" on public.hiring_settings for select to app_be using (workspace_id is not null);
drop policy if exists "hiring_settings_app_be_insert" on public.hiring_settings;
create policy "hiring_settings_app_be_insert" on public.hiring_settings for insert to app_be with check (workspace_id is not null);
drop policy if exists "hiring_settings_app_be_update" on public.hiring_settings;
create policy "hiring_settings_app_be_update" on public.hiring_settings for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "hiring_settings_app_be_delete" on public.hiring_settings;
create policy "hiring_settings_app_be_delete" on public.hiring_settings for delete to app_be using (workspace_id is not null);

alter table public.inbound_events enable row level security;
grant select, insert, update, delete on table public.inbound_events to app_be;
drop policy if exists "inbound_events_app_be_select" on public.inbound_events;
create policy "inbound_events_app_be_select" on public.inbound_events for select to app_be using (workspace_id is not null);
drop policy if exists "inbound_events_app_be_insert" on public.inbound_events;
create policy "inbound_events_app_be_insert" on public.inbound_events for insert to app_be with check (workspace_id is not null);
drop policy if exists "inbound_events_app_be_update" on public.inbound_events;
create policy "inbound_events_app_be_update" on public.inbound_events for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "inbound_events_app_be_delete" on public.inbound_events;
create policy "inbound_events_app_be_delete" on public.inbound_events for delete to app_be using (workspace_id is not null);

alter table public.inventory_items enable row level security;
grant select, insert, update, delete on table public.inventory_items to app_be;
drop policy if exists "inventory_items_app_be_select" on public.inventory_items;
create policy "inventory_items_app_be_select" on public.inventory_items for select to app_be using (workspace_id is not null);
drop policy if exists "inventory_items_app_be_insert" on public.inventory_items;
create policy "inventory_items_app_be_insert" on public.inventory_items for insert to app_be with check (workspace_id is not null);
drop policy if exists "inventory_items_app_be_update" on public.inventory_items;
create policy "inventory_items_app_be_update" on public.inventory_items for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "inventory_items_app_be_delete" on public.inventory_items;
create policy "inventory_items_app_be_delete" on public.inventory_items for delete to app_be using (workspace_id is not null);

alter table public.inventory_locations enable row level security;
grant select, insert, update, delete on table public.inventory_locations to app_be;
drop policy if exists "inventory_locations_app_be_select" on public.inventory_locations;
create policy "inventory_locations_app_be_select" on public.inventory_locations for select to app_be using (workspace_id is not null);
drop policy if exists "inventory_locations_app_be_insert" on public.inventory_locations;
create policy "inventory_locations_app_be_insert" on public.inventory_locations for insert to app_be with check (workspace_id is not null);
drop policy if exists "inventory_locations_app_be_update" on public.inventory_locations;
create policy "inventory_locations_app_be_update" on public.inventory_locations for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "inventory_locations_app_be_delete" on public.inventory_locations;
create policy "inventory_locations_app_be_delete" on public.inventory_locations for delete to app_be using (workspace_id is not null);

alter table public.inventory_movements enable row level security;
grant select, insert on table public.inventory_movements to app_be;
drop policy if exists "inventory_movements_app_be_select" on public.inventory_movements;
create policy "inventory_movements_app_be_select" on public.inventory_movements for select to app_be using (workspace_id is not null);
drop policy if exists "inventory_movements_app_be_insert" on public.inventory_movements;
create policy "inventory_movements_app_be_insert" on public.inventory_movements for insert to app_be with check (workspace_id is not null);

alter table public.inventory_po_lines enable row level security;
grant select, insert, update, delete on table public.inventory_po_lines to app_be;
drop policy if exists "inventory_po_lines_app_be_select" on public.inventory_po_lines;
create policy "inventory_po_lines_app_be_select" on public.inventory_po_lines for select to app_be using (workspace_id is not null);
drop policy if exists "inventory_po_lines_app_be_insert" on public.inventory_po_lines;
create policy "inventory_po_lines_app_be_insert" on public.inventory_po_lines for insert to app_be with check (workspace_id is not null);
drop policy if exists "inventory_po_lines_app_be_update" on public.inventory_po_lines;
create policy "inventory_po_lines_app_be_update" on public.inventory_po_lines for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "inventory_po_lines_app_be_delete" on public.inventory_po_lines;
create policy "inventory_po_lines_app_be_delete" on public.inventory_po_lines for delete to app_be using (workspace_id is not null);

alter table public.inventory_purchase_orders enable row level security;
grant select, insert, update, delete on table public.inventory_purchase_orders to app_be;
drop policy if exists "inventory_purchase_orders_app_be_select" on public.inventory_purchase_orders;
create policy "inventory_purchase_orders_app_be_select" on public.inventory_purchase_orders for select to app_be using (workspace_id is not null);
drop policy if exists "inventory_purchase_orders_app_be_insert" on public.inventory_purchase_orders;
create policy "inventory_purchase_orders_app_be_insert" on public.inventory_purchase_orders for insert to app_be with check (workspace_id is not null);
drop policy if exists "inventory_purchase_orders_app_be_update" on public.inventory_purchase_orders;
create policy "inventory_purchase_orders_app_be_update" on public.inventory_purchase_orders for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "inventory_purchase_orders_app_be_delete" on public.inventory_purchase_orders;
create policy "inventory_purchase_orders_app_be_delete" on public.inventory_purchase_orders for delete to app_be using (workspace_id is not null);

alter table public.inventory_receipts enable row level security;
grant select, insert, update, delete on table public.inventory_receipts to app_be;
drop policy if exists "inventory_receipts_app_be_select" on public.inventory_receipts;
create policy "inventory_receipts_app_be_select" on public.inventory_receipts for select to app_be using (workspace_id is not null);
drop policy if exists "inventory_receipts_app_be_insert" on public.inventory_receipts;
create policy "inventory_receipts_app_be_insert" on public.inventory_receipts for insert to app_be with check (workspace_id is not null);
drop policy if exists "inventory_receipts_app_be_update" on public.inventory_receipts;
create policy "inventory_receipts_app_be_update" on public.inventory_receipts for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "inventory_receipts_app_be_delete" on public.inventory_receipts;
create policy "inventory_receipts_app_be_delete" on public.inventory_receipts for delete to app_be using (workspace_id is not null);

alter table public.inventory_recipe_lines enable row level security;
grant select, insert, update, delete on table public.inventory_recipe_lines to app_be;
drop policy if exists "inventory_recipe_lines_app_be_select" on public.inventory_recipe_lines;
create policy "inventory_recipe_lines_app_be_select" on public.inventory_recipe_lines for select to app_be using (workspace_id is not null);
drop policy if exists "inventory_recipe_lines_app_be_insert" on public.inventory_recipe_lines;
create policy "inventory_recipe_lines_app_be_insert" on public.inventory_recipe_lines for insert to app_be with check (workspace_id is not null);
drop policy if exists "inventory_recipe_lines_app_be_update" on public.inventory_recipe_lines;
create policy "inventory_recipe_lines_app_be_update" on public.inventory_recipe_lines for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "inventory_recipe_lines_app_be_delete" on public.inventory_recipe_lines;
create policy "inventory_recipe_lines_app_be_delete" on public.inventory_recipe_lines for delete to app_be using (workspace_id is not null);

alter table public.inventory_recipes enable row level security;
grant select, insert, update, delete on table public.inventory_recipes to app_be;
drop policy if exists "inventory_recipes_app_be_select" on public.inventory_recipes;
create policy "inventory_recipes_app_be_select" on public.inventory_recipes for select to app_be using (workspace_id is not null);
drop policy if exists "inventory_recipes_app_be_insert" on public.inventory_recipes;
create policy "inventory_recipes_app_be_insert" on public.inventory_recipes for insert to app_be with check (workspace_id is not null);
drop policy if exists "inventory_recipes_app_be_update" on public.inventory_recipes;
create policy "inventory_recipes_app_be_update" on public.inventory_recipes for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "inventory_recipes_app_be_delete" on public.inventory_recipes;
create policy "inventory_recipes_app_be_delete" on public.inventory_recipes for delete to app_be using (workspace_id is not null);

alter table public.inventory_stock_levels enable row level security;
grant select, insert, update, delete on table public.inventory_stock_levels to app_be;
drop policy if exists "inventory_stock_levels_app_be_select" on public.inventory_stock_levels;
create policy "inventory_stock_levels_app_be_select" on public.inventory_stock_levels for select to app_be using (workspace_id is not null);
drop policy if exists "inventory_stock_levels_app_be_insert" on public.inventory_stock_levels;
create policy "inventory_stock_levels_app_be_insert" on public.inventory_stock_levels for insert to app_be with check (workspace_id is not null);
drop policy if exists "inventory_stock_levels_app_be_update" on public.inventory_stock_levels;
create policy "inventory_stock_levels_app_be_update" on public.inventory_stock_levels for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "inventory_stock_levels_app_be_delete" on public.inventory_stock_levels;
create policy "inventory_stock_levels_app_be_delete" on public.inventory_stock_levels for delete to app_be using (workspace_id is not null);

alter table public.inventory_suppliers enable row level security;
grant select, insert, update, delete on table public.inventory_suppliers to app_be;
drop policy if exists "inventory_suppliers_app_be_select" on public.inventory_suppliers;
create policy "inventory_suppliers_app_be_select" on public.inventory_suppliers for select to app_be using (workspace_id is not null);
drop policy if exists "inventory_suppliers_app_be_insert" on public.inventory_suppliers;
create policy "inventory_suppliers_app_be_insert" on public.inventory_suppliers for insert to app_be with check (workspace_id is not null);
drop policy if exists "inventory_suppliers_app_be_update" on public.inventory_suppliers;
create policy "inventory_suppliers_app_be_update" on public.inventory_suppliers for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "inventory_suppliers_app_be_delete" on public.inventory_suppliers;
create policy "inventory_suppliers_app_be_delete" on public.inventory_suppliers for delete to app_be using (workspace_id is not null);

alter table public.invoices enable row level security;
grant select, insert, update, delete on table public.invoices to app_be;
drop policy if exists "invoices_app_be_select" on public.invoices;
create policy "invoices_app_be_select" on public.invoices for select to app_be using (workspace_id is not null);
drop policy if exists "invoices_app_be_insert" on public.invoices;
create policy "invoices_app_be_insert" on public.invoices for insert to app_be with check (workspace_id is not null);
drop policy if exists "invoices_app_be_update" on public.invoices;
create policy "invoices_app_be_update" on public.invoices for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "invoices_app_be_delete" on public.invoices;
create policy "invoices_app_be_delete" on public.invoices for delete to app_be using (workspace_id is not null);

alter table public.knowledge_chunks enable row level security;
grant select, insert, update, delete on table public.knowledge_chunks to app_be;
drop policy if exists "knowledge_chunks_app_be_select" on public.knowledge_chunks;
create policy "knowledge_chunks_app_be_select" on public.knowledge_chunks for select to app_be using (workspace_id is not null);
drop policy if exists "knowledge_chunks_app_be_insert" on public.knowledge_chunks;
create policy "knowledge_chunks_app_be_insert" on public.knowledge_chunks for insert to app_be with check (workspace_id is not null);
drop policy if exists "knowledge_chunks_app_be_update" on public.knowledge_chunks;
create policy "knowledge_chunks_app_be_update" on public.knowledge_chunks for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "knowledge_chunks_app_be_delete" on public.knowledge_chunks;
create policy "knowledge_chunks_app_be_delete" on public.knowledge_chunks for delete to app_be using (workspace_id is not null);

alter table public.knowledge_gaps enable row level security;
grant select, insert, update, delete on table public.knowledge_gaps to app_be;
drop policy if exists "knowledge_gaps_app_be_select" on public.knowledge_gaps;
create policy "knowledge_gaps_app_be_select" on public.knowledge_gaps for select to app_be using (workspace_id is not null);
drop policy if exists "knowledge_gaps_app_be_insert" on public.knowledge_gaps;
create policy "knowledge_gaps_app_be_insert" on public.knowledge_gaps for insert to app_be with check (workspace_id is not null);
drop policy if exists "knowledge_gaps_app_be_update" on public.knowledge_gaps;
create policy "knowledge_gaps_app_be_update" on public.knowledge_gaps for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "knowledge_gaps_app_be_delete" on public.knowledge_gaps;
create policy "knowledge_gaps_app_be_delete" on public.knowledge_gaps for delete to app_be using (workspace_id is not null);

alter table public.knowledge_sources enable row level security;
grant select, insert, update, delete on table public.knowledge_sources to app_be;
drop policy if exists "knowledge_sources_app_be_select" on public.knowledge_sources;
create policy "knowledge_sources_app_be_select" on public.knowledge_sources for select to app_be using (workspace_id is not null);
drop policy if exists "knowledge_sources_app_be_insert" on public.knowledge_sources;
create policy "knowledge_sources_app_be_insert" on public.knowledge_sources for insert to app_be with check (workspace_id is not null);
drop policy if exists "knowledge_sources_app_be_update" on public.knowledge_sources;
create policy "knowledge_sources_app_be_update" on public.knowledge_sources for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "knowledge_sources_app_be_delete" on public.knowledge_sources;
create policy "knowledge_sources_app_be_delete" on public.knowledge_sources for delete to app_be using (workspace_id is not null);

alter table public.knowledge_suggestion_state enable row level security;
grant select, insert, update, delete on table public.knowledge_suggestion_state to app_be;
drop policy if exists "knowledge_suggestion_state_app_be_select" on public.knowledge_suggestion_state;
create policy "knowledge_suggestion_state_app_be_select" on public.knowledge_suggestion_state for select to app_be using (workspace_id is not null);
drop policy if exists "knowledge_suggestion_state_app_be_insert" on public.knowledge_suggestion_state;
create policy "knowledge_suggestion_state_app_be_insert" on public.knowledge_suggestion_state for insert to app_be with check (workspace_id is not null);
drop policy if exists "knowledge_suggestion_state_app_be_update" on public.knowledge_suggestion_state;
create policy "knowledge_suggestion_state_app_be_update" on public.knowledge_suggestion_state for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "knowledge_suggestion_state_app_be_delete" on public.knowledge_suggestion_state;
create policy "knowledge_suggestion_state_app_be_delete" on public.knowledge_suggestion_state for delete to app_be using (workspace_id is not null);

alter table public.lead_flows enable row level security;
grant select, insert, update, delete on table public.lead_flows to app_be;
drop policy if exists "lead_flows_app_be_select" on public.lead_flows;
create policy "lead_flows_app_be_select" on public.lead_flows for select to app_be using (workspace_id is not null);
drop policy if exists "lead_flows_app_be_insert" on public.lead_flows;
create policy "lead_flows_app_be_insert" on public.lead_flows for insert to app_be with check (workspace_id is not null);
drop policy if exists "lead_flows_app_be_update" on public.lead_flows;
create policy "lead_flows_app_be_update" on public.lead_flows for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "lead_flows_app_be_delete" on public.lead_flows;
create policy "lead_flows_app_be_delete" on public.lead_flows for delete to app_be using (workspace_id is not null);

alter table public.leads enable row level security;
grant select, insert, update, delete on table public.leads to app_be;
drop policy if exists "leads_app_be_select" on public.leads;
create policy "leads_app_be_select" on public.leads for select to app_be using (workspace_id is not null);
drop policy if exists "leads_app_be_insert" on public.leads;
create policy "leads_app_be_insert" on public.leads for insert to app_be with check (workspace_id is not null);
drop policy if exists "leads_app_be_update" on public.leads;
create policy "leads_app_be_update" on public.leads for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "leads_app_be_delete" on public.leads;
create policy "leads_app_be_delete" on public.leads for delete to app_be using (workspace_id is not null);

alter table public.loyalty_campaigns enable row level security;
grant select, insert, update, delete on table public.loyalty_campaigns to app_be;
drop policy if exists "loyalty_campaigns_app_be_select" on public.loyalty_campaigns;
create policy "loyalty_campaigns_app_be_select" on public.loyalty_campaigns for select to app_be using (workspace_id is not null);
drop policy if exists "loyalty_campaigns_app_be_insert" on public.loyalty_campaigns;
create policy "loyalty_campaigns_app_be_insert" on public.loyalty_campaigns for insert to app_be with check (workspace_id is not null);
drop policy if exists "loyalty_campaigns_app_be_update" on public.loyalty_campaigns;
create policy "loyalty_campaigns_app_be_update" on public.loyalty_campaigns for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "loyalty_campaigns_app_be_delete" on public.loyalty_campaigns;
create policy "loyalty_campaigns_app_be_delete" on public.loyalty_campaigns for delete to app_be using (workspace_id is not null);

alter table public.loyalty_customer_links enable row level security;
grant select, insert, update, delete on table public.loyalty_customer_links to app_be;
drop policy if exists "loyalty_customer_links_app_be_select" on public.loyalty_customer_links;
create policy "loyalty_customer_links_app_be_select" on public.loyalty_customer_links for select to app_be using (workspace_id is not null);
drop policy if exists "loyalty_customer_links_app_be_insert" on public.loyalty_customer_links;
create policy "loyalty_customer_links_app_be_insert" on public.loyalty_customer_links for insert to app_be with check (workspace_id is not null);
drop policy if exists "loyalty_customer_links_app_be_update" on public.loyalty_customer_links;
create policy "loyalty_customer_links_app_be_update" on public.loyalty_customer_links for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "loyalty_customer_links_app_be_delete" on public.loyalty_customer_links;
create policy "loyalty_customer_links_app_be_delete" on public.loyalty_customer_links for delete to app_be using (workspace_id is not null);

alter table public.loyalty_customers enable row level security;
grant select, insert, update, delete on table public.loyalty_customers to app_be;
drop policy if exists "loyalty_customers_app_be_select" on public.loyalty_customers;
create policy "loyalty_customers_app_be_select" on public.loyalty_customers for select to app_be using (workspace_id is not null);
drop policy if exists "loyalty_customers_app_be_insert" on public.loyalty_customers;
create policy "loyalty_customers_app_be_insert" on public.loyalty_customers for insert to app_be with check (workspace_id is not null);
drop policy if exists "loyalty_customers_app_be_update" on public.loyalty_customers;
create policy "loyalty_customers_app_be_update" on public.loyalty_customers for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "loyalty_customers_app_be_delete" on public.loyalty_customers;
create policy "loyalty_customers_app_be_delete" on public.loyalty_customers for delete to app_be using (workspace_id is not null);

alter table public.loyalty_ledger enable row level security;
grant select, insert on table public.loyalty_ledger to app_be;
drop policy if exists "loyalty_ledger_app_be_select" on public.loyalty_ledger;
create policy "loyalty_ledger_app_be_select" on public.loyalty_ledger for select to app_be using (workspace_id is not null);
drop policy if exists "loyalty_ledger_app_be_insert" on public.loyalty_ledger;
create policy "loyalty_ledger_app_be_insert" on public.loyalty_ledger for insert to app_be with check (workspace_id is not null);

alter table public.loyalty_otps enable row level security;
grant select, insert, update, delete on table public.loyalty_otps to app_be;
drop policy if exists "loyalty_otps_app_be_select" on public.loyalty_otps;
create policy "loyalty_otps_app_be_select" on public.loyalty_otps for select to app_be using (workspace_id is not null);
drop policy if exists "loyalty_otps_app_be_insert" on public.loyalty_otps;
create policy "loyalty_otps_app_be_insert" on public.loyalty_otps for insert to app_be with check (workspace_id is not null);
drop policy if exists "loyalty_otps_app_be_update" on public.loyalty_otps;
create policy "loyalty_otps_app_be_update" on public.loyalty_otps for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "loyalty_otps_app_be_delete" on public.loyalty_otps;
create policy "loyalty_otps_app_be_delete" on public.loyalty_otps for delete to app_be using (workspace_id is not null);

alter table public.loyalty_programs enable row level security;
grant select, insert, update, delete on table public.loyalty_programs to app_be;
drop policy if exists "loyalty_programs_app_be_select" on public.loyalty_programs;
create policy "loyalty_programs_app_be_select" on public.loyalty_programs for select to app_be using (workspace_id is not null);
drop policy if exists "loyalty_programs_app_be_insert" on public.loyalty_programs;
create policy "loyalty_programs_app_be_insert" on public.loyalty_programs for insert to app_be with check (workspace_id is not null);
drop policy if exists "loyalty_programs_app_be_update" on public.loyalty_programs;
create policy "loyalty_programs_app_be_update" on public.loyalty_programs for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "loyalty_programs_app_be_delete" on public.loyalty_programs;
create policy "loyalty_programs_app_be_delete" on public.loyalty_programs for delete to app_be using (workspace_id is not null);

alter table public.loyalty_rewards enable row level security;
grant select, insert, update, delete on table public.loyalty_rewards to app_be;
drop policy if exists "loyalty_rewards_app_be_select" on public.loyalty_rewards;
create policy "loyalty_rewards_app_be_select" on public.loyalty_rewards for select to app_be using (workspace_id is not null);
drop policy if exists "loyalty_rewards_app_be_insert" on public.loyalty_rewards;
create policy "loyalty_rewards_app_be_insert" on public.loyalty_rewards for insert to app_be with check (workspace_id is not null);
drop policy if exists "loyalty_rewards_app_be_update" on public.loyalty_rewards;
create policy "loyalty_rewards_app_be_update" on public.loyalty_rewards for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "loyalty_rewards_app_be_delete" on public.loyalty_rewards;
create policy "loyalty_rewards_app_be_delete" on public.loyalty_rewards for delete to app_be using (workspace_id is not null);

alter table public.loyalty_sends enable row level security;
grant select, insert, update, delete on table public.loyalty_sends to app_be;
drop policy if exists "loyalty_sends_app_be_select" on public.loyalty_sends;
create policy "loyalty_sends_app_be_select" on public.loyalty_sends for select to app_be using (workspace_id is not null);
drop policy if exists "loyalty_sends_app_be_insert" on public.loyalty_sends;
create policy "loyalty_sends_app_be_insert" on public.loyalty_sends for insert to app_be with check (workspace_id is not null);
drop policy if exists "loyalty_sends_app_be_update" on public.loyalty_sends;
create policy "loyalty_sends_app_be_update" on public.loyalty_sends for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "loyalty_sends_app_be_delete" on public.loyalty_sends;
create policy "loyalty_sends_app_be_delete" on public.loyalty_sends for delete to app_be using (workspace_id is not null);

alter table public.messages enable row level security;
grant select, insert, update, delete on table public.messages to app_be;
drop policy if exists "messages_app_be_select" on public.messages;
create policy "messages_app_be_select" on public.messages for select to app_be using (workspace_id is not null);
drop policy if exists "messages_app_be_insert" on public.messages;
create policy "messages_app_be_insert" on public.messages for insert to app_be with check (workspace_id is not null);
drop policy if exists "messages_app_be_update" on public.messages;
create policy "messages_app_be_update" on public.messages for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "messages_app_be_delete" on public.messages;
create policy "messages_app_be_delete" on public.messages for delete to app_be using (workspace_id is not null);

alter table public.meta_comments enable row level security;
grant select, insert, update, delete on table public.meta_comments to app_be;
drop policy if exists "meta_comments_app_be_select" on public.meta_comments;
create policy "meta_comments_app_be_select" on public.meta_comments for select to app_be using (connection_id is not null);
drop policy if exists "meta_comments_app_be_insert" on public.meta_comments;
create policy "meta_comments_app_be_insert" on public.meta_comments for insert to app_be with check (connection_id is not null);
drop policy if exists "meta_comments_app_be_update" on public.meta_comments;
create policy "meta_comments_app_be_update" on public.meta_comments for update to app_be using (connection_id is not null) with check (connection_id is not null);
drop policy if exists "meta_comments_app_be_delete" on public.meta_comments;
create policy "meta_comments_app_be_delete" on public.meta_comments for delete to app_be using (connection_id is not null);

alter table public.meta_threads enable row level security;
grant select, insert, update, delete on table public.meta_threads to app_be;
drop policy if exists "meta_threads_app_be_select" on public.meta_threads;
create policy "meta_threads_app_be_select" on public.meta_threads for select to app_be using (connection_id is not null);
drop policy if exists "meta_threads_app_be_insert" on public.meta_threads;
create policy "meta_threads_app_be_insert" on public.meta_threads for insert to app_be with check (connection_id is not null);
drop policy if exists "meta_threads_app_be_update" on public.meta_threads;
create policy "meta_threads_app_be_update" on public.meta_threads for update to app_be using (connection_id is not null) with check (connection_id is not null);
drop policy if exists "meta_threads_app_be_delete" on public.meta_threads;
create policy "meta_threads_app_be_delete" on public.meta_threads for delete to app_be using (connection_id is not null);

alter table public.module_context_notes enable row level security;
grant select, insert, update, delete on table public.module_context_notes to app_be;
drop policy if exists "module_context_notes_app_be_select" on public.module_context_notes;
create policy "module_context_notes_app_be_select" on public.module_context_notes for select to app_be using (workspace_id is not null);
drop policy if exists "module_context_notes_app_be_insert" on public.module_context_notes;
create policy "module_context_notes_app_be_insert" on public.module_context_notes for insert to app_be with check (workspace_id is not null);
drop policy if exists "module_context_notes_app_be_update" on public.module_context_notes;
create policy "module_context_notes_app_be_update" on public.module_context_notes for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "module_context_notes_app_be_delete" on public.module_context_notes;
create policy "module_context_notes_app_be_delete" on public.module_context_notes for delete to app_be using (workspace_id is not null);

alter table public.module_context_versions enable row level security;
grant select, insert, update, delete on table public.module_context_versions to app_be;
drop policy if exists "module_context_versions_app_be_select" on public.module_context_versions;
create policy "module_context_versions_app_be_select" on public.module_context_versions for select to app_be using (workspace_id is not null);
drop policy if exists "module_context_versions_app_be_insert" on public.module_context_versions;
create policy "module_context_versions_app_be_insert" on public.module_context_versions for insert to app_be with check (workspace_id is not null);
drop policy if exists "module_context_versions_app_be_update" on public.module_context_versions;
create policy "module_context_versions_app_be_update" on public.module_context_versions for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "module_context_versions_app_be_delete" on public.module_context_versions;
create policy "module_context_versions_app_be_delete" on public.module_context_versions for delete to app_be using (workspace_id is not null);

alter table public.module_installations enable row level security;
grant select, insert, update, delete on table public.module_installations to app_be;
drop policy if exists "module_installations_app_be_select" on public.module_installations;
create policy "module_installations_app_be_select" on public.module_installations for select to app_be using (workspace_id is not null);
drop policy if exists "module_installations_app_be_insert" on public.module_installations;
create policy "module_installations_app_be_insert" on public.module_installations for insert to app_be with check (workspace_id is not null);
drop policy if exists "module_installations_app_be_update" on public.module_installations;
create policy "module_installations_app_be_update" on public.module_installations for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "module_installations_app_be_delete" on public.module_installations;
create policy "module_installations_app_be_delete" on public.module_installations for delete to app_be using (workspace_id is not null);

alter table public.module_setup_messages enable row level security;
grant select, insert, update, delete on table public.module_setup_messages to app_be;
drop policy if exists "module_setup_messages_app_be_select" on public.module_setup_messages;
create policy "module_setup_messages_app_be_select" on public.module_setup_messages for select to app_be using (workspace_id is not null);
drop policy if exists "module_setup_messages_app_be_insert" on public.module_setup_messages;
create policy "module_setup_messages_app_be_insert" on public.module_setup_messages for insert to app_be with check (workspace_id is not null);
drop policy if exists "module_setup_messages_app_be_update" on public.module_setup_messages;
create policy "module_setup_messages_app_be_update" on public.module_setup_messages for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "module_setup_messages_app_be_delete" on public.module_setup_messages;
create policy "module_setup_messages_app_be_delete" on public.module_setup_messages for delete to app_be using (workspace_id is not null);

alter table public.module_setup_sessions enable row level security;
grant select, insert, update, delete on table public.module_setup_sessions to app_be;
drop policy if exists "module_setup_sessions_app_be_select" on public.module_setup_sessions;
create policy "module_setup_sessions_app_be_select" on public.module_setup_sessions for select to app_be using (workspace_id is not null);
drop policy if exists "module_setup_sessions_app_be_insert" on public.module_setup_sessions;
create policy "module_setup_sessions_app_be_insert" on public.module_setup_sessions for insert to app_be with check (workspace_id is not null);
drop policy if exists "module_setup_sessions_app_be_update" on public.module_setup_sessions;
create policy "module_setup_sessions_app_be_update" on public.module_setup_sessions for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "module_setup_sessions_app_be_delete" on public.module_setup_sessions;
create policy "module_setup_sessions_app_be_delete" on public.module_setup_sessions for delete to app_be using (workspace_id is not null);

alter table public.module_setup_writes enable row level security;
grant select, insert, update, delete on table public.module_setup_writes to app_be;
drop policy if exists "module_setup_writes_app_be_select" on public.module_setup_writes;
create policy "module_setup_writes_app_be_select" on public.module_setup_writes for select to app_be using (workspace_id is not null);
drop policy if exists "module_setup_writes_app_be_insert" on public.module_setup_writes;
create policy "module_setup_writes_app_be_insert" on public.module_setup_writes for insert to app_be with check (workspace_id is not null);
drop policy if exists "module_setup_writes_app_be_update" on public.module_setup_writes;
create policy "module_setup_writes_app_be_update" on public.module_setup_writes for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "module_setup_writes_app_be_delete" on public.module_setup_writes;
create policy "module_setup_writes_app_be_delete" on public.module_setup_writes for delete to app_be using (workspace_id is not null);

alter table public.modules enable row level security;
grant select, insert, update on table public.modules to app_be;
drop policy if exists "modules_app_be_select" on public.modules;
create policy "modules_app_be_select" on public.modules for select to app_be using (key is not null);
drop policy if exists "modules_app_be_insert" on public.modules;
create policy "modules_app_be_insert" on public.modules for insert to app_be with check (key is not null);
drop policy if exists "modules_app_be_update" on public.modules;
create policy "modules_app_be_update" on public.modules for update to app_be using (key is not null) with check (key is not null);

alter table public.n8n_pipelines enable row level security;
grant select, insert, update, delete on table public.n8n_pipelines to app_be;
drop policy if exists "n8n_pipelines_app_be_select" on public.n8n_pipelines;
create policy "n8n_pipelines_app_be_select" on public.n8n_pipelines for select to app_be using (workspace_id is not null);
drop policy if exists "n8n_pipelines_app_be_insert" on public.n8n_pipelines;
create policy "n8n_pipelines_app_be_insert" on public.n8n_pipelines for insert to app_be with check (workspace_id is not null);
drop policy if exists "n8n_pipelines_app_be_update" on public.n8n_pipelines;
create policy "n8n_pipelines_app_be_update" on public.n8n_pipelines for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "n8n_pipelines_app_be_delete" on public.n8n_pipelines;
create policy "n8n_pipelines_app_be_delete" on public.n8n_pipelines for delete to app_be using (workspace_id is not null);

alter table public.n8n_platform_config enable row level security;
grant select, insert, update on table public.n8n_platform_config to app_be;
drop policy if exists "n8n_platform_config_app_be_select" on public.n8n_platform_config;
create policy "n8n_platform_config_app_be_select" on public.n8n_platform_config for select to app_be using (key is not null);
drop policy if exists "n8n_platform_config_app_be_insert" on public.n8n_platform_config;
create policy "n8n_platform_config_app_be_insert" on public.n8n_platform_config for insert to app_be with check (key is not null);
drop policy if exists "n8n_platform_config_app_be_update" on public.n8n_platform_config;
create policy "n8n_platform_config_app_be_update" on public.n8n_platform_config for update to app_be using (key is not null) with check (key is not null);

alter table public.n8n_runs enable row level security;
grant select, insert, update, delete on table public.n8n_runs to app_be;
drop policy if exists "n8n_runs_app_be_select" on public.n8n_runs;
create policy "n8n_runs_app_be_select" on public.n8n_runs for select to app_be using (workspace_id is not null);
drop policy if exists "n8n_runs_app_be_insert" on public.n8n_runs;
create policy "n8n_runs_app_be_insert" on public.n8n_runs for insert to app_be with check (workspace_id is not null);
drop policy if exists "n8n_runs_app_be_update" on public.n8n_runs;
create policy "n8n_runs_app_be_update" on public.n8n_runs for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "n8n_runs_app_be_delete" on public.n8n_runs;
create policy "n8n_runs_app_be_delete" on public.n8n_runs for delete to app_be using (workspace_id is not null);

alter table public.nivo_knowledge enable row level security;
grant select, insert, update, delete on table public.nivo_knowledge to app_be;
drop policy if exists "nivo_knowledge_app_be_select" on public.nivo_knowledge;
create policy "nivo_knowledge_app_be_select" on public.nivo_knowledge for select to app_be using (id is not null);
drop policy if exists "nivo_knowledge_app_be_insert" on public.nivo_knowledge;
create policy "nivo_knowledge_app_be_insert" on public.nivo_knowledge for insert to app_be with check (id is not null);
drop policy if exists "nivo_knowledge_app_be_update" on public.nivo_knowledge;
create policy "nivo_knowledge_app_be_update" on public.nivo_knowledge for update to app_be using (id is not null) with check (id is not null);
drop policy if exists "nivo_knowledge_app_be_delete" on public.nivo_knowledge;
create policy "nivo_knowledge_app_be_delete" on public.nivo_knowledge for delete to app_be using (id is not null);

alter table public.office_command_candidates enable row level security;
grant select, insert, update, delete on table public.office_command_candidates to app_be;
drop policy if exists "office_command_candidates_app_be_select" on public.office_command_candidates;
create policy "office_command_candidates_app_be_select" on public.office_command_candidates for select to app_be using (workspace_id is not null);
drop policy if exists "office_command_candidates_app_be_insert" on public.office_command_candidates;
create policy "office_command_candidates_app_be_insert" on public.office_command_candidates for insert to app_be with check (workspace_id is not null);
drop policy if exists "office_command_candidates_app_be_update" on public.office_command_candidates;
create policy "office_command_candidates_app_be_update" on public.office_command_candidates for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "office_command_candidates_app_be_delete" on public.office_command_candidates;
create policy "office_command_candidates_app_be_delete" on public.office_command_candidates for delete to app_be using (workspace_id is not null);

alter table public.openclaw_agent_sync enable row level security;
grant select, insert, update, delete on table public.openclaw_agent_sync to app_be;
drop policy if exists "openclaw_agent_sync_app_be_select" on public.openclaw_agent_sync;
create policy "openclaw_agent_sync_app_be_select" on public.openclaw_agent_sync for select to app_be using (workspace_id is not null);
drop policy if exists "openclaw_agent_sync_app_be_insert" on public.openclaw_agent_sync;
create policy "openclaw_agent_sync_app_be_insert" on public.openclaw_agent_sync for insert to app_be with check (workspace_id is not null);
drop policy if exists "openclaw_agent_sync_app_be_update" on public.openclaw_agent_sync;
create policy "openclaw_agent_sync_app_be_update" on public.openclaw_agent_sync for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "openclaw_agent_sync_app_be_delete" on public.openclaw_agent_sync;
create policy "openclaw_agent_sync_app_be_delete" on public.openclaw_agent_sync for delete to app_be using (workspace_id is not null);

alter table public.orders enable row level security;
grant select, insert, update, delete on table public.orders to app_be;
drop policy if exists "orders_app_be_select" on public.orders;
create policy "orders_app_be_select" on public.orders for select to app_be using (workspace_id is not null);
drop policy if exists "orders_app_be_insert" on public.orders;
create policy "orders_app_be_insert" on public.orders for insert to app_be with check (workspace_id is not null);
drop policy if exists "orders_app_be_update" on public.orders;
create policy "orders_app_be_update" on public.orders for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "orders_app_be_delete" on public.orders;
create policy "orders_app_be_delete" on public.orders for delete to app_be using (workspace_id is not null);

alter table public.payment_orders enable row level security;
grant select, insert, update, delete on table public.payment_orders to app_be;
drop policy if exists "payment_orders_app_be_select" on public.payment_orders;
create policy "payment_orders_app_be_select" on public.payment_orders for select to app_be using (workspace_id is not null);
drop policy if exists "payment_orders_app_be_insert" on public.payment_orders;
create policy "payment_orders_app_be_insert" on public.payment_orders for insert to app_be with check (workspace_id is not null);
drop policy if exists "payment_orders_app_be_update" on public.payment_orders;
create policy "payment_orders_app_be_update" on public.payment_orders for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "payment_orders_app_be_delete" on public.payment_orders;
create policy "payment_orders_app_be_delete" on public.payment_orders for delete to app_be using (workspace_id is not null);

alter table public.plans enable row level security;
grant select on table public.plans to app_be;
drop policy if exists "plans_app_be_select" on public.plans;
create policy "plans_app_be_select" on public.plans for select to app_be using (code is not null);

alter table public.platform_audit enable row level security;
grant select, insert on table public.platform_audit to app_be;
drop policy if exists "platform_audit_app_be_select" on public.platform_audit;
create policy "platform_audit_app_be_select" on public.platform_audit for select to app_be using (workspace_id is not null);
drop policy if exists "platform_audit_app_be_insert" on public.platform_audit;
create policy "platform_audit_app_be_insert" on public.platform_audit for insert to app_be with check (workspace_id is not null);

alter table public.responsibilities enable row level security;
grant select, insert, update, delete on table public.responsibilities to app_be;
drop policy if exists "responsibilities_app_be_select" on public.responsibilities;
create policy "responsibilities_app_be_select" on public.responsibilities for select to app_be using (workspace_id is not null);
drop policy if exists "responsibilities_app_be_insert" on public.responsibilities;
create policy "responsibilities_app_be_insert" on public.responsibilities for insert to app_be with check (workspace_id is not null);
drop policy if exists "responsibilities_app_be_update" on public.responsibilities;
create policy "responsibilities_app_be_update" on public.responsibilities for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "responsibilities_app_be_delete" on public.responsibilities;
create policy "responsibilities_app_be_delete" on public.responsibilities for delete to app_be using (workspace_id is not null);

alter table public.sepay_transactions enable row level security;
grant select, insert, update on table public.sepay_transactions to app_be;
drop policy if exists "sepay_transactions_app_be_select" on public.sepay_transactions;
create policy "sepay_transactions_app_be_select" on public.sepay_transactions for select to app_be using (id is not null);
drop policy if exists "sepay_transactions_app_be_insert" on public.sepay_transactions;
create policy "sepay_transactions_app_be_insert" on public.sepay_transactions for insert to app_be with check (id is not null);
drop policy if exists "sepay_transactions_app_be_update" on public.sepay_transactions;
create policy "sepay_transactions_app_be_update" on public.sepay_transactions for update to app_be using (id is not null) with check (id is not null);

alter table public.shifts_attendance enable row level security;
grant select, insert, update, delete on table public.shifts_attendance to app_be;
drop policy if exists "shifts_attendance_app_be_select" on public.shifts_attendance;
create policy "shifts_attendance_app_be_select" on public.shifts_attendance for select to app_be using (workspace_id is not null);
drop policy if exists "shifts_attendance_app_be_insert" on public.shifts_attendance;
create policy "shifts_attendance_app_be_insert" on public.shifts_attendance for insert to app_be with check (workspace_id is not null);
drop policy if exists "shifts_attendance_app_be_update" on public.shifts_attendance;
create policy "shifts_attendance_app_be_update" on public.shifts_attendance for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "shifts_attendance_app_be_delete" on public.shifts_attendance;
create policy "shifts_attendance_app_be_delete" on public.shifts_attendance for delete to app_be using (workspace_id is not null);

alter table public.shifts_availability enable row level security;
grant select, insert, update, delete on table public.shifts_availability to app_be;
drop policy if exists "shifts_availability_app_be_select" on public.shifts_availability;
create policy "shifts_availability_app_be_select" on public.shifts_availability for select to app_be using (workspace_id is not null);
drop policy if exists "shifts_availability_app_be_insert" on public.shifts_availability;
create policy "shifts_availability_app_be_insert" on public.shifts_availability for insert to app_be with check (workspace_id is not null);
drop policy if exists "shifts_availability_app_be_update" on public.shifts_availability;
create policy "shifts_availability_app_be_update" on public.shifts_availability for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "shifts_availability_app_be_delete" on public.shifts_availability;
create policy "shifts_availability_app_be_delete" on public.shifts_availability for delete to app_be using (workspace_id is not null);

alter table public.shifts_coverage enable row level security;
grant select, insert, update, delete on table public.shifts_coverage to app_be;
drop policy if exists "shifts_coverage_app_be_select" on public.shifts_coverage;
create policy "shifts_coverage_app_be_select" on public.shifts_coverage for select to app_be using (workspace_id is not null);
drop policy if exists "shifts_coverage_app_be_insert" on public.shifts_coverage;
create policy "shifts_coverage_app_be_insert" on public.shifts_coverage for insert to app_be with check (workspace_id is not null);
drop policy if exists "shifts_coverage_app_be_update" on public.shifts_coverage;
create policy "shifts_coverage_app_be_update" on public.shifts_coverage for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "shifts_coverage_app_be_delete" on public.shifts_coverage;
create policy "shifts_coverage_app_be_delete" on public.shifts_coverage for delete to app_be using (workspace_id is not null);

alter table public.shifts_leave_requests enable row level security;
grant select, insert, update, delete on table public.shifts_leave_requests to app_be;
drop policy if exists "shifts_leave_requests_app_be_select" on public.shifts_leave_requests;
create policy "shifts_leave_requests_app_be_select" on public.shifts_leave_requests for select to app_be using (workspace_id is not null);
drop policy if exists "shifts_leave_requests_app_be_insert" on public.shifts_leave_requests;
create policy "shifts_leave_requests_app_be_insert" on public.shifts_leave_requests for insert to app_be with check (workspace_id is not null);
drop policy if exists "shifts_leave_requests_app_be_update" on public.shifts_leave_requests;
create policy "shifts_leave_requests_app_be_update" on public.shifts_leave_requests for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "shifts_leave_requests_app_be_delete" on public.shifts_leave_requests;
create policy "shifts_leave_requests_app_be_delete" on public.shifts_leave_requests for delete to app_be using (workspace_id is not null);

alter table public.shifts_notifications enable row level security;
grant select, insert, update, delete on table public.shifts_notifications to app_be;
drop policy if exists "shifts_notifications_app_be_select" on public.shifts_notifications;
create policy "shifts_notifications_app_be_select" on public.shifts_notifications for select to app_be using (workspace_id is not null);
drop policy if exists "shifts_notifications_app_be_insert" on public.shifts_notifications;
create policy "shifts_notifications_app_be_insert" on public.shifts_notifications for insert to app_be with check (workspace_id is not null);
drop policy if exists "shifts_notifications_app_be_update" on public.shifts_notifications;
create policy "shifts_notifications_app_be_update" on public.shifts_notifications for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "shifts_notifications_app_be_delete" on public.shifts_notifications;
create policy "shifts_notifications_app_be_delete" on public.shifts_notifications for delete to app_be using (workspace_id is not null);

alter table public.shifts_positions enable row level security;
grant select, insert, update, delete on table public.shifts_positions to app_be;
drop policy if exists "shifts_positions_app_be_select" on public.shifts_positions;
create policy "shifts_positions_app_be_select" on public.shifts_positions for select to app_be using (workspace_id is not null);
drop policy if exists "shifts_positions_app_be_insert" on public.shifts_positions;
create policy "shifts_positions_app_be_insert" on public.shifts_positions for insert to app_be with check (workspace_id is not null);
drop policy if exists "shifts_positions_app_be_update" on public.shifts_positions;
create policy "shifts_positions_app_be_update" on public.shifts_positions for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "shifts_positions_app_be_delete" on public.shifts_positions;
create policy "shifts_positions_app_be_delete" on public.shifts_positions for delete to app_be using (workspace_id is not null);

alter table public.shifts_schedules enable row level security;
grant select, insert, update, delete on table public.shifts_schedules to app_be;
drop policy if exists "shifts_schedules_app_be_select" on public.shifts_schedules;
create policy "shifts_schedules_app_be_select" on public.shifts_schedules for select to app_be using (workspace_id is not null);
drop policy if exists "shifts_schedules_app_be_insert" on public.shifts_schedules;
create policy "shifts_schedules_app_be_insert" on public.shifts_schedules for insert to app_be with check (workspace_id is not null);
drop policy if exists "shifts_schedules_app_be_update" on public.shifts_schedules;
create policy "shifts_schedules_app_be_update" on public.shifts_schedules for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "shifts_schedules_app_be_delete" on public.shifts_schedules;
create policy "shifts_schedules_app_be_delete" on public.shifts_schedules for delete to app_be using (workspace_id is not null);

alter table public.shifts_settings enable row level security;
grant select, insert, update, delete on table public.shifts_settings to app_be;
drop policy if exists "shifts_settings_app_be_select" on public.shifts_settings;
create policy "shifts_settings_app_be_select" on public.shifts_settings for select to app_be using (workspace_id is not null);
drop policy if exists "shifts_settings_app_be_insert" on public.shifts_settings;
create policy "shifts_settings_app_be_insert" on public.shifts_settings for insert to app_be with check (workspace_id is not null);
drop policy if exists "shifts_settings_app_be_update" on public.shifts_settings;
create policy "shifts_settings_app_be_update" on public.shifts_settings for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "shifts_settings_app_be_delete" on public.shifts_settings;
create policy "shifts_settings_app_be_delete" on public.shifts_settings for delete to app_be using (workspace_id is not null);

alter table public.shifts_shifts enable row level security;
grant select, insert, update, delete on table public.shifts_shifts to app_be;
drop policy if exists "shifts_shifts_app_be_select" on public.shifts_shifts;
create policy "shifts_shifts_app_be_select" on public.shifts_shifts for select to app_be using (workspace_id is not null);
drop policy if exists "shifts_shifts_app_be_insert" on public.shifts_shifts;
create policy "shifts_shifts_app_be_insert" on public.shifts_shifts for insert to app_be with check (workspace_id is not null);
drop policy if exists "shifts_shifts_app_be_update" on public.shifts_shifts;
create policy "shifts_shifts_app_be_update" on public.shifts_shifts for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "shifts_shifts_app_be_delete" on public.shifts_shifts;
create policy "shifts_shifts_app_be_delete" on public.shifts_shifts for delete to app_be using (workspace_id is not null);

alter table public.shifts_staff enable row level security;
grant select, insert, update, delete on table public.shifts_staff to app_be;
drop policy if exists "shifts_staff_app_be_select" on public.shifts_staff;
create policy "shifts_staff_app_be_select" on public.shifts_staff for select to app_be using (workspace_id is not null);
drop policy if exists "shifts_staff_app_be_insert" on public.shifts_staff;
create policy "shifts_staff_app_be_insert" on public.shifts_staff for insert to app_be with check (workspace_id is not null);
drop policy if exists "shifts_staff_app_be_update" on public.shifts_staff;
create policy "shifts_staff_app_be_update" on public.shifts_staff for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "shifts_staff_app_be_delete" on public.shifts_staff;
create policy "shifts_staff_app_be_delete" on public.shifts_staff for delete to app_be using (workspace_id is not null);

alter table public.shifts_staff_pay enable row level security;
grant select, insert, update, delete on table public.shifts_staff_pay to app_be;
drop policy if exists "shifts_staff_pay_app_be_select" on public.shifts_staff_pay;
create policy "shifts_staff_pay_app_be_select" on public.shifts_staff_pay for select to app_be using (workspace_id is not null);
drop policy if exists "shifts_staff_pay_app_be_insert" on public.shifts_staff_pay;
create policy "shifts_staff_pay_app_be_insert" on public.shifts_staff_pay for insert to app_be with check (workspace_id is not null);
drop policy if exists "shifts_staff_pay_app_be_update" on public.shifts_staff_pay;
create policy "shifts_staff_pay_app_be_update" on public.shifts_staff_pay for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "shifts_staff_pay_app_be_delete" on public.shifts_staff_pay;
create policy "shifts_staff_pay_app_be_delete" on public.shifts_staff_pay for delete to app_be using (workspace_id is not null);

alter table public.shifts_swap_requests enable row level security;
grant select, insert, update, delete on table public.shifts_swap_requests to app_be;
drop policy if exists "shifts_swap_requests_app_be_select" on public.shifts_swap_requests;
create policy "shifts_swap_requests_app_be_select" on public.shifts_swap_requests for select to app_be using (workspace_id is not null);
drop policy if exists "shifts_swap_requests_app_be_insert" on public.shifts_swap_requests;
create policy "shifts_swap_requests_app_be_insert" on public.shifts_swap_requests for insert to app_be with check (workspace_id is not null);
drop policy if exists "shifts_swap_requests_app_be_update" on public.shifts_swap_requests;
create policy "shifts_swap_requests_app_be_update" on public.shifts_swap_requests for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "shifts_swap_requests_app_be_delete" on public.shifts_swap_requests;
create policy "shifts_swap_requests_app_be_delete" on public.shifts_swap_requests for delete to app_be using (workspace_id is not null);

alter table public.staff enable row level security;
grant select, insert, update, delete on table public.staff to app_be;
drop policy if exists "staff_app_be_select" on public.staff;
create policy "staff_app_be_select" on public.staff for select to app_be using (workspace_id is not null);
drop policy if exists "staff_app_be_insert" on public.staff;
create policy "staff_app_be_insert" on public.staff for insert to app_be with check (workspace_id is not null);
drop policy if exists "staff_app_be_update" on public.staff;
create policy "staff_app_be_update" on public.staff for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "staff_app_be_delete" on public.staff;
create policy "staff_app_be_delete" on public.staff for delete to app_be using (workspace_id is not null);

alter table public.transactions enable row level security;
grant select, insert, update, delete on table public.transactions to app_be;
drop policy if exists "transactions_app_be_select" on public.transactions;
create policy "transactions_app_be_select" on public.transactions for select to app_be using (workspace_id is not null);
drop policy if exists "transactions_app_be_insert" on public.transactions;
create policy "transactions_app_be_insert" on public.transactions for insert to app_be with check (workspace_id is not null);
drop policy if exists "transactions_app_be_update" on public.transactions;
create policy "transactions_app_be_update" on public.transactions for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "transactions_app_be_delete" on public.transactions;
create policy "transactions_app_be_delete" on public.transactions for delete to app_be using (workspace_id is not null);

alter table public.video_brand_kits enable row level security;
grant select, insert, update, delete on table public.video_brand_kits to app_be;
drop policy if exists "video_brand_kits_app_be_select" on public.video_brand_kits;
create policy "video_brand_kits_app_be_select" on public.video_brand_kits for select to app_be using (workspace_id is not null);
drop policy if exists "video_brand_kits_app_be_insert" on public.video_brand_kits;
create policy "video_brand_kits_app_be_insert" on public.video_brand_kits for insert to app_be with check (workspace_id is not null);
drop policy if exists "video_brand_kits_app_be_update" on public.video_brand_kits;
create policy "video_brand_kits_app_be_update" on public.video_brand_kits for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "video_brand_kits_app_be_delete" on public.video_brand_kits;
create policy "video_brand_kits_app_be_delete" on public.video_brand_kits for delete to app_be using (workspace_id is not null);

alter table public.video_project_versions enable row level security;
grant select, insert, update, delete on table public.video_project_versions to app_be;
drop policy if exists "video_project_versions_app_be_select" on public.video_project_versions;
create policy "video_project_versions_app_be_select" on public.video_project_versions for select to app_be using (workspace_id is not null);
drop policy if exists "video_project_versions_app_be_insert" on public.video_project_versions;
create policy "video_project_versions_app_be_insert" on public.video_project_versions for insert to app_be with check (workspace_id is not null);
drop policy if exists "video_project_versions_app_be_update" on public.video_project_versions;
create policy "video_project_versions_app_be_update" on public.video_project_versions for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "video_project_versions_app_be_delete" on public.video_project_versions;
create policy "video_project_versions_app_be_delete" on public.video_project_versions for delete to app_be using (workspace_id is not null);

alter table public.video_projects enable row level security;
grant select, insert, update, delete on table public.video_projects to app_be;
drop policy if exists "video_projects_app_be_select" on public.video_projects;
create policy "video_projects_app_be_select" on public.video_projects for select to app_be using (workspace_id is not null);
drop policy if exists "video_projects_app_be_insert" on public.video_projects;
create policy "video_projects_app_be_insert" on public.video_projects for insert to app_be with check (workspace_id is not null);
drop policy if exists "video_projects_app_be_update" on public.video_projects;
create policy "video_projects_app_be_update" on public.video_projects for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "video_projects_app_be_delete" on public.video_projects;
create policy "video_projects_app_be_delete" on public.video_projects for delete to app_be using (workspace_id is not null);

alter table public.video_renders enable row level security;
grant select, insert, update, delete on table public.video_renders to app_be;
drop policy if exists "video_renders_app_be_select" on public.video_renders;
create policy "video_renders_app_be_select" on public.video_renders for select to app_be using (workspace_id is not null);
drop policy if exists "video_renders_app_be_insert" on public.video_renders;
create policy "video_renders_app_be_insert" on public.video_renders for insert to app_be with check (workspace_id is not null);
drop policy if exists "video_renders_app_be_update" on public.video_renders;
create policy "video_renders_app_be_update" on public.video_renders for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "video_renders_app_be_delete" on public.video_renders;
create policy "video_renders_app_be_delete" on public.video_renders for delete to app_be using (workspace_id is not null);

alter table public.work_items enable row level security;
grant select, insert, update, delete on table public.work_items to app_be;
drop policy if exists "work_items_app_be_select" on public.work_items;
create policy "work_items_app_be_select" on public.work_items for select to app_be using (workspace_id is not null);
drop policy if exists "work_items_app_be_insert" on public.work_items;
create policy "work_items_app_be_insert" on public.work_items for insert to app_be with check (workspace_id is not null);
drop policy if exists "work_items_app_be_update" on public.work_items;
create policy "work_items_app_be_update" on public.work_items for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "work_items_app_be_delete" on public.work_items;
create policy "work_items_app_be_delete" on public.work_items for delete to app_be using (workspace_id is not null);

alter table public.workspace_api_keys enable row level security;
grant select, insert, update, delete on table public.workspace_api_keys to app_be;
drop policy if exists "workspace_api_keys_app_be_select" on public.workspace_api_keys;
create policy "workspace_api_keys_app_be_select" on public.workspace_api_keys for select to app_be using (workspace_id is not null);
drop policy if exists "workspace_api_keys_app_be_insert" on public.workspace_api_keys;
create policy "workspace_api_keys_app_be_insert" on public.workspace_api_keys for insert to app_be with check (workspace_id is not null);
drop policy if exists "workspace_api_keys_app_be_update" on public.workspace_api_keys;
create policy "workspace_api_keys_app_be_update" on public.workspace_api_keys for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "workspace_api_keys_app_be_delete" on public.workspace_api_keys;
create policy "workspace_api_keys_app_be_delete" on public.workspace_api_keys for delete to app_be using (workspace_id is not null);

alter table public.workspace_invites enable row level security;
grant select, insert, update, delete on table public.workspace_invites to app_be;
drop policy if exists "workspace_invites_app_be_select" on public.workspace_invites;
create policy "workspace_invites_app_be_select" on public.workspace_invites for select to app_be using (workspace_id is not null);
drop policy if exists "workspace_invites_app_be_insert" on public.workspace_invites;
create policy "workspace_invites_app_be_insert" on public.workspace_invites for insert to app_be with check (workspace_id is not null);
drop policy if exists "workspace_invites_app_be_update" on public.workspace_invites;
create policy "workspace_invites_app_be_update" on public.workspace_invites for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "workspace_invites_app_be_delete" on public.workspace_invites;
create policy "workspace_invites_app_be_delete" on public.workspace_invites for delete to app_be using (workspace_id is not null);

alter table public.workspace_members enable row level security;
grant select, insert, update, delete on table public.workspace_members to app_be;
drop policy if exists "workspace_members_app_be_select" on public.workspace_members;
create policy "workspace_members_app_be_select" on public.workspace_members for select to app_be using (workspace_id is not null);
drop policy if exists "workspace_members_app_be_insert" on public.workspace_members;
create policy "workspace_members_app_be_insert" on public.workspace_members for insert to app_be with check (workspace_id is not null);
drop policy if exists "workspace_members_app_be_update" on public.workspace_members;
create policy "workspace_members_app_be_update" on public.workspace_members for update to app_be using (workspace_id is not null) with check (workspace_id is not null);
drop policy if exists "workspace_members_app_be_delete" on public.workspace_members;
create policy "workspace_members_app_be_delete" on public.workspace_members for delete to app_be using (workspace_id is not null);

alter table public.workspaces enable row level security;
grant select, insert, update, delete on table public.workspaces to app_be;
drop policy if exists "workspaces_app_be_select" on public.workspaces;
create policy "workspaces_app_be_select" on public.workspaces for select to app_be using (id is not null);
drop policy if exists "workspaces_app_be_insert" on public.workspaces;
create policy "workspaces_app_be_insert" on public.workspaces for insert to app_be with check (id is not null);
drop policy if exists "workspaces_app_be_update" on public.workspaces;
create policy "workspaces_app_be_update" on public.workspaces for update to app_be using (id is not null) with check (id is not null);
drop policy if exists "workspaces_app_be_delete" on public.workspaces;
create policy "workspaces_app_be_delete" on public.workspaces for delete to app_be using (id is not null);
