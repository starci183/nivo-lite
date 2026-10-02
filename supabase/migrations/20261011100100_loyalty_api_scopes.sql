-- New API keys may also use the loyalty endpoints (GET /api/v1/loyalty/members, POST /api/v1/loyalty/award|redeem|promo). Existing keys keep their scopes.
alter table public.workspace_api_keys alter column scopes set default '{leads:read,leads:write,messages:write,knowledge:write,events:read,loyalty:read,loyalty:write}';
