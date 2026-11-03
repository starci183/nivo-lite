-- The email doors of sign-in move to the hfs 5.3.0 template glue (domain/identity IdentityEmailService over @starci/mail): sign up,
-- confirm the mailbox, resend, forgot and reset password. Expand step: two tables are added, nothing is dropped, so the release before
-- this one keeps working against the same database.
--
-- public.identity_email_tokens replaces public.identity_password_tokens: the single-use links of a confirmation and of a password
-- reset, stored by their sha256 only. An invitation link is a reset link with a longer lifetime, so a live 'invite' token becomes a
-- 'reset' token here. public.identity_password_tokens is dropped by a later contract migration once this release is the only one running.
--
-- public.identity_attempts is the sign-in counter of @starci/auth (migrations/identity-sessions.sql): the failures of one address in one
-- window, shared by every replica. The counter used to live in the shared rate-limit store.

create table public.identity_email_tokens (
    id uuid primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    purpose varchar(16) not null check (purpose in ('confirm', 'reset')),
    token_hash varchar(64) not null,
    expires_at timestamptz not null,
    used_at timestamptz,
    created_at timestamptz not null,
    constraint identity_email_tokens_hash_key unique (token_hash)
);

create index identity_email_tokens_user_idx on public.identity_email_tokens (user_id, purpose);

alter table public.identity_email_tokens enable row level security;
alter table public.identity_email_tokens force row level security;
revoke all on table public.identity_email_tokens from public;
grant select, insert, update, delete on table public.identity_email_tokens to app_be;
create policy identity_email_tokens_app_be_all on public.identity_email_tokens
    for all to app_be using (current_user = 'app_be') with check (current_user = 'app_be');

-- The links still waiting to be spent keep working: a person who was mailed a link before the release can still follow it.
insert into public.identity_email_tokens (id, user_id, purpose, token_hash, expires_at, used_at, created_at)
select t.id,
       t.user_id,
       case when t.purpose = 'confirm' then 'confirm' else 'reset' end,
       t.token_hash,
       t.expires_at,
       t.used_at,
       t.created_at
  from public.identity_password_tokens t
 where t.used_at is null
   and t.expires_at > now()
   and length(t.token_hash) = 64;

create table public.identity_attempts (
    key varchar(128) primary key,
    hits integer not null,
    reset_at timestamptz not null
);

create index identity_attempts_reset_idx on public.identity_attempts (reset_at);

alter table public.identity_attempts enable row level security;
alter table public.identity_attempts force row level security;
revoke all on table public.identity_attempts from public;
grant select, insert, update, delete on table public.identity_attempts to app_be;
create policy identity_attempts_app_be_all on public.identity_attempts
    for all to app_be using (current_user = 'app_be') with check (current_user = 'app_be');
