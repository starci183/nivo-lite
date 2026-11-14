import { PROVIDER, TRIGGER } from "@nivo-lite/agent-sdk/names"
import { z } from "zod"
import type { OptionalCanonicalEvent, TriggerDeclaration } from "@modules/domain/provider-triggers"

/*
 * THE TEAM CHAT'S TRIGGER (stage 1 of the one event pipeline, concept triggers rule 13): a line a member wrote to an agent in /chat (the
 * `@agent` tag), as ONE canonical event for the tagged agent. Pure: the translate reads only its argument. The member behind it rides in the
 * data and beside the event (`actorMemberId`), never as a subject: a member is no customer.
 */

/** The trigger's name. */
export const TEAM_CHAT_MESSAGE = "chat.message.received"

/** One tag a member wrote: the room, the message, the words, the agent it hands them to and the member who wrote it. */
export type TeamChatTagRaw = {
    /** The room the member wrote in (it is the thread of the event). */
    readonly roomId: string
    /** The message that carries the tag. */
    readonly messageId: string
    /** The words the member wrote. */
    readonly text: string
    /** The agent the tag hands the words to. */
    readonly agentId: string
    /** The member who wrote the message. */
    readonly actorMemberId: string
}

/** The data of a tag: the room thread (the key), the message, the words and the member who wrote them. */
export type TeamChatMessageData = {
    /** The thread the event belongs to (the room): the trigger's key. */
    readonly threadId: string
    /** The room the member wrote in. */
    readonly roomId: string
    /** The message that carries the tag. */
    readonly messageId: string
    /** The words the member wrote. */
    readonly text: string
    /** The member who wrote the message. */
    readonly actorMemberId: string
}

/** The translate: one event per (message, tagged agent), the once-key the tag's wake always had. The room is the thread. */
export const translateTeamChatTag = (raw: TeamChatTagRaw): OptionalCanonicalEvent<TeamChatMessageData> => {
    if (raw.roomId === "" || raw.messageId === "" || raw.agentId === "") return null
    return {
        id: `chat-tag:${raw.messageId}:${raw.agentId}`,
        data: {
            threadId: raw.roomId,
            roomId: raw.roomId,
            messageId: raw.messageId,
            text: raw.text,
            actorMemberId: raw.actorMemberId,
        },
    }
}

/** The team chat's declaration, keyed by the room thread. */
export const TEAM_CHAT_MESSAGE_TRIGGER: TriggerDeclaration<TeamChatTagRaw, TeamChatMessageData> = {
    provider: PROVIDER.nivo,
    name: TEAM_CHAT_MESSAGE,
    verb: TRIGGER.chatMessageReceived,
    via: "internal",
    raw: z.object({
        roomId: z.string().max(200),
        messageId: z.string().max(200),
        text: z.string(),
        agentId: z.string().max(200),
        actorMemberId: z.string().max(200),
    }),
    data: z.object({
        threadId: z.string().min(1).max(200),
        roomId: z.string().min(1).max(200),
        messageId: z.string().min(1).max(200),
        text: z.string(),
        actorMemberId: z.string().max(200),
    }),
    translate: translateTeamChatTag,
    key: { by: "data", member: "threadId" },
    settle: null,
}
