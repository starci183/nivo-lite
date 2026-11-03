-- A connection may hold a second sealed secret: the API token NIVO sends TO the provider to read its data (a bank feed poll), beside the
-- credential the provider sends to NIVO. It is sealed with the same connection key as the credential, so there is one key and one cipher.
-- connection_secrets already grants app_be SELECT, INSERT, UPDATE and DELETE on the table and has its row policies, so the new column
-- needs no further grant or policy.
ALTER TABLE public.connection_secrets ADD COLUMN IF NOT EXISTS api_token_ciphertext text;
