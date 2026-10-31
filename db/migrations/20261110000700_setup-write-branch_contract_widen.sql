-- module-setup-writes: the setup chat proposes a third kind of confirm card, `branch`: where the amount bands of an action meet, and who
-- is asked above the line. Additive: the check is widened by one value; no row changes.

ALTER TABLE public.module_setup_writes DROP CONSTRAINT module_setup_writes_kind_check;
ALTER TABLE public.module_setup_writes
    ADD CONSTRAINT module_setup_writes_kind_check CHECK ((kind = ANY (ARRAY['fact'::text, 'rule'::text, 'branch'::text])));
