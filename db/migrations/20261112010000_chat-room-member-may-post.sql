-- chat-room-member-may-post: forward-only; immutable once on origin/main.
-- The right of an agent to post in a group room, held on its seat: an agent always reaches the founder's direct room, but a line lands
-- in a group (a module's team room, the common room) only when a manager of that room gave the agent the right, because a group line
-- reaches every member. Membership alone is not the right. Only an agent seat holds it; every seat starts without it.

ALTER TABLE public.chat_room_members ADD COLUMN may_post boolean DEFAULT false NOT NULL;
ALTER TABLE public.chat_room_members ADD CONSTRAINT chat_room_members_may_post_check CHECK (NOT may_post OR member_kind = 'agent');
