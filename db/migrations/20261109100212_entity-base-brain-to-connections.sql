-- entity-base-brain-to-connections: forward-only; immutable once on origin/main.
-- Entity-base round (BE-PERSISTENCE-3), brain, channel, chat and connection tables (a to k): every table the entities now map through AbstractEntity / UuidAbstractEntity
-- carries created_at and updated_at as timestamptz NOT NULL DEFAULT now(), and a BEFORE UPDATE trigger (public.set_updated_at) stamps updated_at, so the application never writes it.
-- Left out on purpose: append-only logs, ledgers and dedupe claims, where an updated_at would be wrong (listed in the entity-base round notes).

ALTER TABLE public.brain_commands ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER brain_commands_set_updated_at BEFORE UPDATE ON public.brain_commands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brain_extractions ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER brain_extractions_set_updated_at BEFORE UPDATE ON public.brain_extractions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brain_facts ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER brain_facts_set_updated_at BEFORE UPDATE ON public.brain_facts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.brain_lessons ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.brain_lessons ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER brain_lessons_set_updated_at BEFORE UPDATE ON public.brain_lessons FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.chat_markers ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.chat_markers ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER chat_markers_set_updated_at BEFORE UPDATE ON public.chat_markers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.connection_commands ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER connection_commands_set_updated_at BEFORE UPDATE ON public.connection_commands FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.connection_secrets ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.connection_secrets ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
CREATE TRIGGER connection_secrets_set_updated_at BEFORE UPDATE ON public.connection_secrets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER connections_set_updated_at BEFORE UPDATE ON public.connections FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
