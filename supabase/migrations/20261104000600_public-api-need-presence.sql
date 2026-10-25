-- Additive: NULL retains the historical default-text sentinel policy. Do not backfill it.
ALTER TABLE public.public_api ADD COLUMN need_supplied boolean;

COMMENT ON COLUMN public.public_api.need_supplied IS
    'Nonempty need explicitly supplied by the API caller. NULL means historical admission; default-text need is omitted.';
