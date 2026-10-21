-- Customer conversations remember the party a connector keeps for their customer (the answer of the `identity.find` or
-- `identity.upsert` role), so a turn does not ask the connector again; how a customer is matched (channel identity or phone) is
-- the workspace's own data in the installation settings, never code.

ALTER TABLE public.agent_conversations
    ADD COLUMN connector_party_id text,
    ADD COLUMN connector_party_name text,
    ADD COLUMN connector_party_at timestamp with time zone;

ALTER TABLE public.agent_conversations
    ADD CONSTRAINT agent_conversations_connector_party_id_length
        CHECK ((connector_party_id IS NULL OR char_length(connector_party_id) BETWEEN 1 AND 200)),
    ADD CONSTRAINT agent_conversations_connector_party_name_length
        CHECK ((connector_party_name IS NULL OR char_length(connector_party_name) <= 200));
