-- An agent is named by its role and a generated id ("Agent Chatbot #23233"), and the owner renames it freely. The id is stored next to the
-- name so two agents of a workspace never draw the same one: five digits, unique inside the workspace. Expand only: the column is nullable,
-- no row changes, an agent named before it existed keeps its name and stays without an id, and an old reader never selects the column.

ALTER TABLE public.agents
    ADD COLUMN serial integer,
    ADD CONSTRAINT agents_serial_range_check CHECK (serial IS NULL OR serial BETWEEN 10000 AND 99999);

CREATE UNIQUE INDEX agents_workspace_serial_key
    ON public.agents USING btree (workspace_id, serial)
    WHERE (serial IS NOT NULL);
