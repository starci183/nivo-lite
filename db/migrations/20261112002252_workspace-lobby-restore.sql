-- workspace-lobby-restore: forward-only; immutable once on origin/main.
-- The lobby's restore of a deleted workspace, the decline of an invitation as its own fact, and who switched a seat off.

-- A declined invitation is neither pending nor revoked: the invited person said no, and the inviter's team page says so.
ALTER TABLE public.workspace_invites ADD COLUMN declined_at timestamp with time zone;
ALTER TABLE public.workspace_invites ADD COLUMN declined_by uuid;

-- Who switched a seat off, when and why (the member reads it in the lobby); cleared when the seat is switched on again.
ALTER TABLE public.workspace_members ADD COLUMN disabled_at timestamp with time zone;
ALTER TABLE public.workspace_members ADD COLUMN disabled_by uuid;
ALTER TABLE public.workspace_members ADD COLUMN disabled_note text;
ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_disabled_note_check
    CHECK (disabled_note IS NULL OR char_length(disabled_note) <= 500);

-- A seat the deletion of its workspace switched off: restoring the workspace switches exactly these on again.
ALTER TABLE public.workspace_members ADD COLUMN disabled_by_deletion boolean DEFAULT false NOT NULL;

-- An agent the deletion of its workspace paused: restoring the workspace resumes exactly these.
ALTER TABLE public.agents ADD COLUMN paused_by_deletion boolean DEFAULT false NOT NULL;
