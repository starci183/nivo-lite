-- first-party-adoption: every installation that already runs a built-in module is recorded as an install of the first-party package of that
-- module, version 1 (key 'nivo-<module>'), with a free license, so built-in and creator agents update through the one mechanism.
-- Expand only and inert: it inserts rows into template_licenses and template_installs and touches nothing else. No agent graph, version,
-- draft, authority rule or installation row is read for writing here, so every existing agent reads the same graph and behaves the same
-- after as before. The package itself is made by the platform sync (it needs the catalogue); until it exists an install offers no update.
-- Rerunning it adds nothing: an installation that has a template_installs row is skipped.

WITH adopted AS (
    SELECT i.id AS installation_id, i.workspace_id, 'nivo-' || i.module_key AS template_key, gen_random_uuid() AS license_id
    FROM public.module_installations i
    JOIN public.modules m ON m.key = i.module_key
    WHERE NOT EXISTS (SELECT 1 FROM public.template_installs t WHERE t.installation_id = i.id)
),
licensed AS (
    INSERT INTO public.template_licenses (id, workspace_id, template_key, kind, installation_id, status)
    SELECT license_id, workspace_id, template_key, 'free', installation_id, 'active' FROM adopted
    RETURNING id
)
INSERT INTO public.template_installs (installation_id, workspace_id, template_key, version, parameter_values, license_id)
SELECT a.installation_id, a.workspace_id, a.template_key, 1, '{}'::jsonb, a.license_id
FROM adopted a
JOIN licensed l ON l.id = a.license_id;
