-- route-id-columns: forward-only; immutable once on origin/main. WRITTEN, NOT APPLIED by the DECOUPLE lane: RESTART-R applies it.
-- Owner order 2026-11-14 ("đổi tên cột conversation_id thành route_id đi"): in the ENGINE a column that holds a ROUTE id (customer_routes.id,
-- the opaque id of a person on one entrance) is named `route_id`; `conversation_id` stays only inside the chatbot package, where it means its
-- own chat record id. Every engine table below holds a route id in that column since the customer-routes flip (20261113220000). A RENAME keeps
-- the data, the indexes, the unique constraints and the row-level-security policies that read the column (they follow the column); the index
-- and constraint NAMES that say "conversation" are renamed too, so the catalogue says what they hold.
-- NOT touched (not the engine's, or not a route): public.bookings, public.booking_waitlist, public.hiring_candidates (module tables of the old
-- business layer; their column is a module record's id), the `records_*` partitions (record JSON members, the records' own business),
-- public.conversation_holds (dropped by 20261114000700, ruling R35).

ALTER TABLE public.contact_freezes RENAME COLUMN conversation_id TO route_id;

ALTER TABLE public.run_stops RENAME COLUMN conversation_id TO route_id;

ALTER TABLE public.contact_memory RENAME COLUMN conversation_id TO route_id;

ALTER TABLE public.mcp_call_log RENAME COLUMN conversation_id TO route_id;
