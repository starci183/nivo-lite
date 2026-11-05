-- brain-dossiers-owner-due: forward-only; immutable once on origin/main.
-- A dossier gets an owner (a membership id of its workspace, as a finding's assignee is) and a due date. Both stay empty until somebody
-- sets them; a checklist import never writes them. Table grants and row level security of public.brain_dossiers already cover the columns.
ALTER TABLE public.brain_dossiers ADD COLUMN assignee_id uuid;
ALTER TABLE public.brain_dossiers ADD COLUMN due_at date;
