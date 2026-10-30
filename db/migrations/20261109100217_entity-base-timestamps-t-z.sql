-- entity-base-timestamps-t-z: forward-only; immutable once on origin/main.
-- Entity-base round (BE-PERSISTENCE-3), telegram_inbox through zalo_wizard_drafts (t to z): every table the entities now map through AbstractEntity / UuidAbstractEntity
-- carries created_at and updated_at as timestamptz NOT NULL DEFAULT now(), and a BEFORE UPDATE trigger (public.set_updated_at, created by
-- 20261109100202_entity-base-set-updated-at) stamps updated_at, so the application never writes it.
-- Left out on purpose: video_project_versions (append-only snapshots, written once by save).

ALTER TABLE public.telegram_inbox ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.telegram_inbox ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER telegram_inbox_set_updated_at BEFORE UPDATE ON public.telegram_inbox FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.thread_messages ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER thread_messages_set_updated_at BEFORE UPDATE ON public.thread_messages FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER thread_work_set_updated_at BEFORE UPDATE ON public.thread_work FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.transactions ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER transactions_set_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.video_brand_kits ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

CREATE TRIGGER video_delegations_set_updated_at BEFORE UPDATE ON public.video_delegations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.work_chains ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.work_chains ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER work_chains_set_updated_at BEFORE UPDATE ON public.work_chains FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER work_threads_set_updated_at BEFORE UPDATE ON public.work_threads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.workspace_invites ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER workspace_invites_set_updated_at BEFORE UPDATE ON public.workspace_invites FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.workspace_members ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER workspace_members_set_updated_at BEFORE UPDATE ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.workspaces ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER workspaces_set_updated_at BEFORE UPDATE ON public.workspaces FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.zalo_inbox ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.zalo_inbox ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER zalo_inbox_set_updated_at BEFORE UPDATE ON public.zalo_inbox FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.zalo_wizard_drafts ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER zalo_wizard_drafts_set_updated_at BEFORE UPDATE ON public.zalo_wizard_drafts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- work_items: updated_at doubled as the claim lease (free when updated_at = created_at or older than the lease), which an updated_at stamped by the
-- database for every change cannot be. The lease gets its own column: NULL = free, otherwise the instant a worker last held the item.
ALTER TABLE public.work_items ADD COLUMN leased_at timestamptz;
UPDATE public.work_items SET leased_at = updated_at WHERE updated_at <> created_at;
CREATE TRIGGER work_items_set_updated_at BEFORE UPDATE ON public.work_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
