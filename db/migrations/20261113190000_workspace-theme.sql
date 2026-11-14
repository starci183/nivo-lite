-- workspace-theme: the brand theme a workspace chose for its console and website chat (hue, chroma, lightness, base, font, radius, optional
-- mode). Null wears the NIVO default. EXPAND only: a nullable column; the be policy validates every member before it is written.
alter table public.workspaces add column if not exists theme jsonb;
