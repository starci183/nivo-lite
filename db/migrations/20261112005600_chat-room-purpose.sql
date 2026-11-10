-- chat-room-purpose: forward-only; immutable once on origin/main.
-- A room says what it is for, so an agent addresses "my team" or "the whole shop" without ever naming a room id: `direct` (a pair),
-- `group` (a plain named group), `common` (the one room of the whole workspace) or `module` (the one room of a module's team, the module
-- in purpose_module). A workspace has at most one common room and one room per module. Existing rooms: a direct room is `direct`, a
-- group is a plain `group`; then the named groups of the dev workspace are mapped by name, the oldest group of that name in each
-- workspace: "Cả tiệm" is the common room, "Bán hàng" the room of the sales module, "Sổ sách" the room of the accounting module. Any
-- other room gets its purpose when it is created or from its settings.

ALTER TABLE public.chat_rooms ADD COLUMN purpose text DEFAULT 'group' NOT NULL;
ALTER TABLE public.chat_rooms ADD COLUMN purpose_module text;

UPDATE public.chat_rooms SET purpose = 'direct' WHERE kind = 'direct';

UPDATE public.chat_rooms AS room
SET purpose = mapped.purpose, purpose_module = mapped.purpose_module
FROM (
    SELECT DISTINCT ON (named.workspace_id, named.name) named.id, wanted.purpose, wanted.purpose_module
    FROM public.chat_rooms AS named
    JOIN (
        VALUES ('Cả tiệm', 'common', NULL::text), ('Bán hàng', 'module', 'sales'), ('Sổ sách', 'module', 'accounting')
    ) AS wanted (name, purpose, purpose_module) ON wanted.name = named.name
    WHERE named.kind = 'group'
    ORDER BY named.workspace_id, named.name, named.created_at, named.id
) AS mapped
WHERE room.id = mapped.id;

ALTER TABLE public.chat_rooms ADD CONSTRAINT chat_rooms_purpose_check CHECK (
    (kind = 'direct' AND purpose = 'direct' AND purpose_module IS NULL)
    OR (kind = 'group' AND purpose IN ('group', 'common') AND purpose_module IS NULL)
    OR (kind = 'group' AND purpose = 'module' AND purpose_module IS NOT NULL AND char_length(purpose_module) BETWEEN 1 AND 64));
CREATE UNIQUE INDEX chat_rooms_common_room ON public.chat_rooms USING btree (workspace_id) WHERE purpose = 'common';
CREATE UNIQUE INDEX chat_rooms_module_room ON public.chat_rooms USING btree (workspace_id, purpose_module) WHERE purpose = 'module';
