-- drop-identity-password-tokens: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the ENGINE-CLEAN-1 worker: the
-- restart owner applies it. The contract half the baseline promised (`identity_email_tokens` replaced `identity_password_tokens`, "dropped by
-- a later contract migration once this release is the only one running"): no entity, service, SQL function or view reads or writes the
-- table (DOMAIN-AUDIT item 2, re-checked by grep over be, db, ext, packages). No other table references it; its index, trigger and
-- policy go with it.

DROP TABLE IF EXISTS public.identity_password_tokens;
