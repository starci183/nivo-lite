-- contacts-soft-delete: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the DECOUPLE lane: RESTART-R applies it.
-- Owner ruling R31 (2026-11-14, "xoa mem nhe"): deleting a contact, and a person's request to have their data erased, are SOFT deletes. The
-- contact is already a tombstone (`contacts.state = 'erased'` with `erased_at`: that IS the deleted mark, no second column); what changes is
-- that NOTHING of it is removed any more: its identities, memory, merges, link tokens, freezes, routes and customer lines stay in the database
-- and every read leaves them out. Expand-compatible: one nullable column, no row changes.
--   1. `contact_identities.erased_at timestamptz NULL`: a copy of the contact's own mark, written in the same transaction as the contact's
--      (the store's `eraseContacts`). A deleted contact's identities stay and are left out of every read. A partial index cannot look at
--      another table, so the mark is carried by the row itself.
--   2. the verified-unique index of identities becomes partial on `erased_at IS NULL`: a deleted contact no longer holds its verified
--      channel id, phone or mail, so the same person writing again is met as a NEW contact that holds it (contacts.md rule 5: a person who
--      asked to be forgotten is not recognised again). Idempotent: skipped when the index already names `erased_at`.
--   3. every foreign key INTO public.contacts that cascades (identities, merges x2, link tokens, memory, freezes; routes and customer lines
--      are written NO ACTION in their own file) becomes NO ACTION: a hard delete of a contact that still has any of these is refused by the
--      database, so "nothing cascades away" is the schema's rule and not only the code's. The application role has no DELETE on `contacts`
--      either (baseline). A workspace delete still removes everything of the workspace: its own cascade reaches every child in the same
--      statement, and NO ACTION is checked at the end of the statement. Written as explicit statements (the constraint names were read
--      from the catalog of this chain, not guessed).
DO $$
BEGIN
    ALTER TABLE public.contact_identities ADD COLUMN IF NOT EXISTS erased_at timestamptz NULL;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
         WHERE schemaname = 'public' AND indexname = 'contact_identities_verified_unique' AND indexdef LIKE '%erased_at IS NULL%'
    ) THEN
        DROP INDEX IF EXISTS public.contact_identities_verified_unique;
        CREATE UNIQUE INDEX contact_identities_verified_unique ON public.contact_identities
            USING btree (workspace_id, kind, provider, account, value) WHERE (verified AND erased_at IS NULL);
    END IF;
END
$$;

-- Step 3 as the explicit statements the catalog loop ran on this chain (every cascading foreign key into public.contacts at
-- 20261114000700; customer_routes / customer_messages are already NO ACTION): the migrate verb refuses a dynamic EXECUTE. Rendered by
-- RESTART-R2 on 2026-11-14 from a copy of dev at 20261114000700.
ALTER TABLE public.contact_freezes DROP CONSTRAINT contact_freezes_contact_id_fkey, ADD CONSTRAINT contact_freezes_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);
ALTER TABLE public.contact_identities DROP CONSTRAINT contact_identities_contact_id_fkey, ADD CONSTRAINT contact_identities_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);
ALTER TABLE public.contact_link_tokens DROP CONSTRAINT contact_link_tokens_contact_id_fkey, ADD CONSTRAINT contact_link_tokens_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);
ALTER TABLE public.contact_memory DROP CONSTRAINT contact_memory_contact_id_fkey, ADD CONSTRAINT contact_memory_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.contacts(id);
ALTER TABLE public.contact_merges DROP CONSTRAINT contact_merges_from_contact_id_fkey, ADD CONSTRAINT contact_merges_from_contact_id_fkey FOREIGN KEY (from_contact_id) REFERENCES public.contacts(id);
ALTER TABLE public.contact_merges DROP CONSTRAINT contact_merges_into_contact_id_fkey, ADD CONSTRAINT contact_merges_into_contact_id_fkey FOREIGN KEY (into_contact_id) REFERENCES public.contacts(id);
