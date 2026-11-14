import { defineEntity, field, type EntityDefinition, type FieldDef } from "@nivo-lite/agent-sdk/entity"

import { MAX_BODY } from "../../../shared/bounds"
import { CHATBOT_CHAT_ENTITY, CHATBOT_NOTE_ENTITY } from "../../../shared/entities/chatbot-entity-names"

/** What a note of a conversation records: a person took the thread over, or gave it back to the AI. */
export const NOTE_KINDS: readonly ["taken", "released"] = ["taken", "released"]

type NoteFields = {
    readonly conversationId: FieldDef<"uuid", false>
    readonly kind: FieldDef<"enum", false>
    readonly text: FieldDef<"text", false>
    readonly at: FieldDef<"timestamptz", false>
    readonly memberId: FieldDef<"uuid", true>
}

const noteFields: NoteFields = {
    conversationId: field.uuid(),
    kind: field.enum({ of: NOTE_KINDS }),
    text: field.text({ maxLength: MAX_BODY }),
    at: field.timestamptz({ default: "now" }),
    memberId: field.uuid({ nullable: true }),
}

/**
 * The chatbot's own note on a conversation (MESSAGES-PLAN section 4, owner's list "notes"): the handling notice a person's take-over or
 * release leaves in the thread. It is no customer message (those are the engine's lines, `platform.customer-messages`); the thread read
 * shows it beside them as a notice line. `memberId` is the person who acted.
 */
export const noteEntity: EntityDefinition<NoteFields> = defineEntity({
    name: CHATBOT_NOTE_ENTITY,
    dataKind: "chat-note",
    fields: noteFields,
    relations: { conversation: { kind: "toOne", target: CHATBOT_CHAT_ENTITY, required: true, onDelete: "cascade" } },
    indexes: [{ name: "conversation_at", on: ["conversationId", { desc: "at" }, { desc: "id" }] }],
})
