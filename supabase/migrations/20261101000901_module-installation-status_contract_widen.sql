-- Module installations: an applied agent whose module requires a connector capability role that no usable connector plays waits in
-- `needs_connection` (it does not run) and is live again once one is connected. Kept apart from `paused`, the owner's own stop.

ALTER TABLE public.module_installations DROP CONSTRAINT module_installations_status_check;
ALTER TABLE public.module_installations
    ADD CONSTRAINT module_installations_status_check
    CHECK ((status = ANY (ARRAY['installing'::text, 'setup'::text, 'ready'::text, 'live'::text, 'paused'::text, 'needs_connection'::text])));
