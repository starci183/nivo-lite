-- agent-templates: the process of an agent packaged as data, so it can be installed again in another workspace and updated without
-- overwriting what the buyer changed. Expand only: four new tables, nothing existing altered.
-- agent_template_versions is immutable (app_be may only select and insert), like agent_graph_versions: a packaged version never changes.
-- template_installs keeps what an update needs to be merged three ways: the version installed and the values the buyer gave.
-- template_licenses is the record of the right to run a template in a workspace, one per install.

CREATE TABLE public.agent_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    key text NOT NULL,
    creator_account_id uuid NOT NULL,
    base_module text NOT NULL,
    name jsonb NOT NULL,
    source_workspace_id uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
    first_party boolean NOT NULL DEFAULT false,
    forked_from text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_templates_key_key UNIQUE (key),
    CONSTRAINT agent_templates_key_check CHECK (key ~ '^[a-z][a-z0-9-]{2,59}$'),
    CONSTRAINT agent_templates_name_check CHECK (jsonb_typeof(name) = 'object')
);
CREATE INDEX agent_templates_creator_idx ON public.agent_templates USING btree (creator_account_id, created_at DESC);

CREATE TABLE public.agent_template_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    template_id uuid NOT NULL REFERENCES public.agent_templates(id) ON DELETE CASCADE,
    key text NOT NULL,
    version integer NOT NULL,
    package jsonb NOT NULL,
    hash text NOT NULL,
    changelog text NOT NULL DEFAULT '',
    breaking boolean NOT NULL DEFAULT false,
    created_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_template_versions_version_key UNIQUE (key, version),
    CONSTRAINT agent_template_versions_version_check CHECK (version >= 1),
    CONSTRAINT agent_template_versions_package_check CHECK (jsonb_typeof(package) = 'object')
);

CREATE TABLE public.template_licenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    template_key text NOT NULL,
    kind text NOT NULL,
    listing_id uuid,
    order_id uuid,
    installation_id uuid,
    status text NOT NULL DEFAULT 'active',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT template_licenses_kind_check CHECK (kind IN ('private', 'free', 'paid')),
    CONSTRAINT template_licenses_status_check CHECK (status IN ('pending', 'active', 'expired', 'revoked'))
);
CREATE UNIQUE INDEX template_licenses_order_key ON public.template_licenses USING btree (order_id) WHERE order_id IS NOT NULL;
CREATE INDEX template_licenses_workspace_idx ON public.template_licenses USING btree (workspace_id, template_key);

CREATE TABLE public.template_installs (
    installation_id uuid NOT NULL PRIMARY KEY REFERENCES public.module_installations(id) ON DELETE CASCADE,
    workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
    template_key text NOT NULL,
    version integer NOT NULL,
    parameter_values jsonb NOT NULL DEFAULT '{}'::jsonb,
    license_id uuid REFERENCES public.template_licenses(id) ON DELETE SET NULL,
    installed_by uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT template_installs_values_check CHECK (jsonb_typeof(parameter_values) = 'object')
);
CREATE INDEX template_installs_template_idx ON public.template_installs USING btree (template_key, version);
CREATE INDEX template_installs_workspace_idx ON public.template_installs USING btree (workspace_id);

CREATE TRIGGER agent_templates_set_updated_at BEFORE UPDATE ON public.agent_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER agent_template_versions_set_updated_at BEFORE UPDATE ON public.agent_template_versions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER template_licenses_set_updated_at BEFORE UPDATE ON public.template_licenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER template_installs_set_updated_at BEFORE UPDATE ON public.template_installs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_templates_app_be_select ON public.agent_templates FOR SELECT TO app_be USING (id IS NOT NULL);
CREATE POLICY agent_templates_app_be_insert ON public.agent_templates FOR INSERT TO app_be WITH CHECK (id IS NOT NULL);
CREATE POLICY agent_templates_app_be_update ON public.agent_templates FOR UPDATE TO app_be USING (id IS NOT NULL) WITH CHECK (id IS NOT NULL);
REVOKE ALL ON TABLE public.agent_templates FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.agent_templates TO app_be;

ALTER TABLE public.agent_template_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY agent_template_versions_app_be_select ON public.agent_template_versions FOR SELECT TO app_be USING (id IS NOT NULL);
CREATE POLICY agent_template_versions_app_be_insert ON public.agent_template_versions FOR INSERT TO app_be WITH CHECK (id IS NOT NULL);
REVOKE ALL ON TABLE public.agent_template_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.agent_template_versions TO app_be;

ALTER TABLE public.template_licenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_licenses_app_be_select ON public.template_licenses FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY template_licenses_app_be_insert ON public.template_licenses FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY template_licenses_app_be_update ON public.template_licenses FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.template_licenses FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.template_licenses TO app_be;

ALTER TABLE public.template_installs ENABLE ROW LEVEL SECURITY;
CREATE POLICY template_installs_app_be_select ON public.template_installs FOR SELECT TO app_be USING (workspace_id IS NOT NULL);
CREATE POLICY template_installs_app_be_insert ON public.template_installs FOR INSERT TO app_be WITH CHECK (workspace_id IS NOT NULL);
CREATE POLICY template_installs_app_be_update ON public.template_installs FOR UPDATE TO app_be USING (workspace_id IS NOT NULL) WITH CHECK (workspace_id IS NOT NULL);
REVOKE ALL ON TABLE public.template_installs FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.template_installs TO app_be;

