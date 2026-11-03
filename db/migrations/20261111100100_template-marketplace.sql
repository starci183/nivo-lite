-- template-marketplace: listings of agent templates with a review state, the consent of a real person to a persona, and the ledger of
-- what a creator is owed. Expand only: three new tables, nothing existing altered.
-- A listing is one template version offered to others: draft, submitted, approved or rejected. The automated checks of the review
-- are kept on the row. The ledger is append-only (app_be may only select and insert); a sale writes the creator share and the fee
-- of the platform from one paid order, and payouts are made by hand outside the app for now.

CREATE TABLE public.template_listings (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    template_key text NOT NULL,
    version integer NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    price_vnd bigint NOT NULL DEFAULT 0,
    revenue_share_pct integer NOT NULL DEFAULT 70,
    checks jsonb NOT NULL DEFAULT '[]'::jsonb,
    review_note text NOT NULL DEFAULT '',
    first_party boolean NOT NULL DEFAULT false,
    submitted_by uuid,
    reviewed_by uuid,
    reviewed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT template_listings_version_key UNIQUE (template_key, version),
    CONSTRAINT template_listings_status_check CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
    CONSTRAINT template_listings_price_check CHECK (price_vnd >= 0),
    CONSTRAINT template_listings_share_check CHECK (revenue_share_pct BETWEEN 0 AND 100),
    CONSTRAINT template_listings_checks_check CHECK (jsonb_typeof(checks) = 'array')
);
CREATE INDEX template_listings_status_idx ON public.template_listings USING btree (status, updated_at DESC);

CREATE TABLE public.template_likeness_grants (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    template_key text NOT NULL,
    person_name text NOT NULL,
    allowed_uses jsonb NOT NULL,
    disclosure text NOT NULL,
    granted_by uuid NOT NULL,
    verified_by uuid,
    verified_at timestamptz,
    expires_at timestamptz,
    revoked_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT template_likeness_grants_uses_check CHECK (jsonb_typeof(allowed_uses) = 'array')
);
CREATE INDEX template_likeness_grants_template_idx ON public.template_likeness_grants USING btree (template_key, person_name);

CREATE TABLE public.creator_ledger_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    creator_account_id uuid NOT NULL,
    template_key text NOT NULL,
    listing_id uuid,
    order_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    kind text NOT NULL,
    amount_vnd bigint NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT creator_ledger_entries_order_kind_key UNIQUE (order_id, kind),
    CONSTRAINT creator_ledger_entries_kind_check CHECK (kind IN ('creator_share', 'platform_fee')),
    CONSTRAINT creator_ledger_entries_amount_check CHECK (amount_vnd >= 0)
);
CREATE INDEX creator_ledger_entries_creator_idx ON public.creator_ledger_entries USING btree (creator_account_id, created_at DESC);

CREATE TRIGGER template_listings_set_updated_at BEFORE UPDATE ON public.template_listings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER template_likeness_grants_set_updated_at BEFORE UPDATE ON public.template_likeness_grants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER creator_ledger_entries_set_updated_at BEFORE UPDATE ON public.creator_ledger_entries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.template_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_listings_app_be_select ON public.template_listings FOR SELECT TO app_be USING (id IS NOT NULL);
CREATE POLICY template_listings_app_be_insert ON public.template_listings FOR INSERT TO app_be WITH CHECK (id IS NOT NULL);
CREATE POLICY template_listings_app_be_update ON public.template_listings FOR UPDATE TO app_be USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
REVOKE ALL ON TABLE public.template_listings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.template_listings TO app_be;

ALTER TABLE public.template_likeness_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_likeness_grants_app_be_select ON public.template_likeness_grants FOR SELECT TO app_be USING (id IS NOT NULL);
CREATE POLICY template_likeness_grants_app_be_insert ON public.template_likeness_grants FOR INSERT TO app_be WITH CHECK (id IS NOT NULL);
CREATE POLICY template_likeness_grants_app_be_update ON public.template_likeness_grants FOR UPDATE TO app_be USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
REVOKE ALL ON TABLE public.template_likeness_grants FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.template_likeness_grants TO app_be;

ALTER TABLE public.creator_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY creator_ledger_entries_app_be_select ON public.creator_ledger_entries FOR SELECT TO app_be USING (id IS NOT NULL);
CREATE POLICY creator_ledger_entries_app_be_insert ON public.creator_ledger_entries FOR INSERT TO app_be WITH CHECK (id IS NOT NULL);
REVOKE ALL ON TABLE public.creator_ledger_entries FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.creator_ledger_entries TO app_be;

