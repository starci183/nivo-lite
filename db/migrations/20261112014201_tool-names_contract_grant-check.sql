-- tool-names_contract_grant-check: forward-only; immutable once on origin/main. CONTRACT half of the tool-name flip; runs after
-- 20261112014200_tool-names-nivo.sql (expand), once the release is accepted.
--
-- public.mcp_tool_grants_tool_check (baseline) refuses a hyphen after the first dot and any namespaced wildcard, so it cannot hold
-- `nivo.team-chat.report.post`, `nivo.team-chat.approval.post` or `nivo.ledger.*`. It is replaced by the CHECK of the flipped names:
--   * an exact grant: `<prefix>.<tool>` where the prefix is a connector key and the tool may hold dots and hyphens
--     (`nivo.team-chat.report.post`, `google.drive.status.get`, a remote `shop.order.place`);
--   * a wildcard: a prefix of one or more segments and `.*` (`sepay.*`, `nivo.ledger.*`, `google.drive.*`);
--   * NEVER a bare `nivo.*` (it would grant every native tool NIVO has; the gateway covers nothing with it either).
-- Then the two kinds of stored grant the expand half could not rename under the old CHECK are renamed: the team-chat door tools and
-- the wildcards (`ledger.*` -> `nivo.ledger.*` covers the same tools it covered before; `drive.*` -> `google.drive.*`; `agent.*` was
-- deleted by the expand half). Until this file runs, such a stored grant names nothing the gateway knows (default deny): dev has none.
-- No drain is needed here: nothing open keys a ledger entry by a grant row.
ALTER TABLE public.mcp_tool_grants DROP CONSTRAINT mcp_tool_grants_tool_check;
ALTER TABLE public.mcp_tool_grants ADD CONSTRAINT mcp_tool_grants_tool_check CHECK (
  tool ~ '^[a-z][a-z0-9-]{1,30}\.(([a-z][a-z0-9-]*\.)*[a-zA-Z][a-zA-Z0-9_-]*|([a-z][a-z0-9-]*\.)*\*)$'
  AND char_length(tool) <= 120
  AND tool <> 'nivo.*'
) NOT VALID;

CREATE TEMP TABLE flip_rest (old text PRIMARY KEY, new text NOT NULL) ON COMMIT DROP;
INSERT INTO flip_rest (old, new) VALUES
  ('team-chat.post-report',   'nivo.team-chat.report.post'),
  ('team-chat.post-approval', 'nivo.team-chat.approval.post'),
  ('ledger.*',    'nivo.ledger.*'),
  ('bank.*',      'nivo.bank.*'),
  ('brain.*',     'nivo.brain.*'),
  ('drive.*',     'google.drive.*'),
  ('dossier.*',   'nivo.dossier.*'),
  ('einvoice.*',  'nivo.einvoice.*'),
  ('chat.*',      'nivo.chat.*'),
  ('team-chat.*', 'nivo.team-chat.*'),
  ('order.*',     'nivo.order.*'),
  ('payment.*',   'nivo.payment.*'),
  ('team.*',      'nivo.team.*'),
  ('work.*',      'nivo.work.*'),
  ('report.*',    'nivo.report.*');

-- An agent holding both names: the new row wins.
DELETE FROM public.mcp_tool_grants g
 USING flip_rest m
 WHERE g.tool = m.old
   AND EXISTS (SELECT 1 FROM public.mcp_tool_grants o WHERE o.agent_id = g.agent_id AND o.tool = m.new);
UPDATE public.mcp_tool_grants g SET tool = m.new, updated_at = now() FROM flip_rest m WHERE g.tool = m.old;
-- A bare nivo.* written by hand before this file (the old CHECK allowed it) grants nothing: removed so the new CHECK validates.
DELETE FROM public.mcp_tool_grants WHERE tool = 'nivo.*';

ALTER TABLE public.mcp_tool_grants VALIDATE CONSTRAINT mcp_tool_grants_tool_check;

-- Final check: no grant left on an OLD native connector or effect domain (a tool born old-style after the flip table, or a row the
-- expand half did not know).
DO $$
DECLARE
  v_left bigint;
BEGIN
  SELECT count(*) INTO v_left FROM public.mcp_tool_grants
   WHERE tool ~ '^(customer|lead|order|payment|team|agent|work|report|ledger|bank|brain|drive|dossier|einvoice|chat|team-chat|ai)\.';
  IF v_left > 0 THEN
    RAISE EXCEPTION 'tool-names_contract_grant-check: % grants still name an old native connector or effect domain', v_left;
  END IF;
END
$$;
