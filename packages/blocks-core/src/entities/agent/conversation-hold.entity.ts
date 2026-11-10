import { defineEntity, field } from "@nivo-lite/agent-sdk/entity"
import type { EntityDefinition, FieldDef } from "@nivo-lite/agent-sdk/entity"

type ConversationHoldFields = {
    readonly conversationId: FieldDef<"uuid", false>
    readonly agentId: FieldDef<"uuid", false>
    readonly runId: FieldDef<"uuid", false>
    readonly workflowId: FieldDef<"uuid", true>
    readonly heldAt: FieldDef<"timestamptz", false>
}

const conversationHoldFields: ConversationHoldFields = {
    conversationId: field.uuid(),
    agentId: field.uuid(),
    runId: field.uuid(),
    workflowId: field.uuid({ nullable: true }),
    heldAt: field.timestamptz({ default: "now" }),
}

/**
 * The agent that keeps a customer conversation between turns: a workflow that declares `entry.holdsConversation` keeps it while its run
 * for the customer has not reached an outcome or handed off, so the customer's next line goes to that agent, not to the front door. One
 * record per conversation, replaced by the next holder and removed when the hold ends. Written by the graph engine only.
 */
export const agentConversationHoldEntity: EntityDefinition<ConversationHoldFields> = defineEntity({
    name: "agent.conversation-hold",
    dataKind: "agent-conversation-hold",
    fields: conversationHoldFields,
    indexes: [{ name: "conversation_lookup", on: ["conversationId", "id"] }],
    constraints: [{ kind: "unique", name: "conversation_key", on: ["conversationId"], refusal: "conversation-held" }],
    matchKeys: [{ name: "conversation", on: ["conversationId"] }],
    // A hold ends for good when its workflow reaches an outcome or hands off: the engine removes the record (no history kept).
    deletable: true,
    view: true,
})
