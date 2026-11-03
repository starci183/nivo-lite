import type { EffectPayload, SubjectRef } from "@nivo-lite/agent-sdk/node"
import type { HandoffInput, HandoffParams } from "./handoff.types"

/** The `agent.tag` payload of a hand-off: the note as text, the context as data for the target's graph, and what is bound of the lead, channel and conversation. */
export const tagPayloadOf = (
    params: HandoffParams,
    input: HandoffInput,
    subject: SubjectRef | null,
): EffectPayload => ({
    toModuleKey: params.toModuleKey,
    visibility: params.visibility,
    text: input.text,
    ...(input.context === null || Object.keys(input.context).length === 0 ? {} : { context: input.context }),
    ...(input.leadId === null ? {} : { leadId: input.leadId }),
    ...(input.channel === null ? {} : { channel: input.channel }),
    ...(input.conversationId === null ? {} : { conversationId: input.conversationId }),
    ...(subject === null ? {} : { subject }),
})
