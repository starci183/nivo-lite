-- contract_drop-signup-name-door: forward-only; the contract step of 20261111100400_signup-name-door.
-- The managed sign-up door of @starci/auth 0.3.0 takes the person's name itself, so Nivo's own door has no caller left. Applied after
-- the release that stopped calling it is accepted (expand before deploy, contract after accept).
DROP FUNCTION public.be_auth_set_signup_name(text, text);
