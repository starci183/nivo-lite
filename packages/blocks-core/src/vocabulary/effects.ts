import { agentTagEffect, channelSendEffect, type EffectDefinition } from "@nivo-lite/agent-sdk/node"
import { agentMessagePostEffect } from "@nivo-lite/agent-sdk/team-chat"

/** The send to a customer is NIVO core (`channelSendEffect` of `@nivo-lite/agent-sdk/node`): the core package lists it and re-exports it from here. */
export { channelSendEffect } from "@nivo-lite/agent-sdk/node"
export type { ChannelSendPayload } from "@nivo-lite/agent-sdk/node"

/** The hand-over of one agent to another is NIVO core (`agentTagEffect` of `@nivo-lite/agent-sdk/node`); the core package lists it and re-exports it from here. */
export { agentTagEffect } from "@nivo-lite/agent-sdk/node"
export type { AgentTagPayload } from "@nivo-lite/agent-sdk/node"

/** The audience, the plain text, the chat answer and the finished card of the team post are the NIVO core contract (`@nivo-lite/agent-sdk/team-chat`); the order cards are built by this package's sales steps (`team-cards.ts`). */
export { agentMessagePostEffect } from "@nivo-lite/agent-sdk/team-chat"
export type {
    AgentMessagePostPayload,
    TeamAudience,
    TeamCardPost,
    TeamChatAnswer,
    TeamText,
} from "@nivo-lite/agent-sdk/team-chat"

/** Every effect the core nodes may run and every undo a compensation runs; the back end registers an executor for each. */
export const coreEffects: ReadonlyArray<EffectDefinition> = [
    channelSendEffect,
    agentTagEffect,
    agentMessagePostEffect,
]
