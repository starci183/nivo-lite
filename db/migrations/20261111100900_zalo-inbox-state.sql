-- Where each Zalo inbox row stands, so NIVO can list the customer messages nobody answered. `received` is stored and owed an answer; `handled` is
-- handed to the agent turn of its conversation or to the person who owns it (or is an event nothing is owed on); `failed` is the last
-- processing attempt that threw (the queue retries it and a success turns it `handled`); `expired` is a polled message past the reply window or the
-- stale age, kept for the owner and never answered by an agent. A row processed before this column existed was handled by the flow that processed it.
ALTER TABLE public.zalo_inbox ADD COLUMN state text NOT NULL DEFAULT 'received';
UPDATE public.zalo_inbox SET state = 'handled' WHERE processed_at IS NOT NULL;
ALTER TABLE public.zalo_inbox ADD CONSTRAINT zalo_inbox_state_check CHECK (state IN ('received', 'handled', 'failed', 'expired'));
CREATE INDEX zalo_inbox_unanswered_idx ON public.zalo_inbox (received_at) WHERE state <> 'handled';
