import type { AgentMessageKind, TeamCardPost } from "@nivo-lite/agent-sdk/team-chat"
import type { TeamCardMessage } from "./team-chat-audience.contracts"

/** The refusal facts of a finished card that cannot be stored: no plugin registers its kind, or its content is not of the kind's shape. */
export const CARD_KIND_NOT_POSTABLE = "kind_not_postable"
export const CARD_PAYLOAD_INVALID = "card_invalid"

/** The message to store, or why none can be built. */
export type PostedCard = { readonly message: TeamCardMessage } | { readonly refused: string }

/**
 * The message of a finished card a package's step built (`TeamCardPost`): its content is checked against the schema of the kind the
 * package registered, and the card is stored as it was given (kind, intent, heading, line, content, record). The engine reads nothing of
 * the content: a kind no plugin registers, or content that is not of the kind's shape, is a refusal fact, never a crash.
 */
export const postedCardOf = (given: TeamCardPost, kind: AgentMessageKind | null): PostedCard => {
    if (kind?.id !== given.kind) return { refused: CARD_KIND_NOT_POSTABLE }
    if (!kind.payload.safeParse(given.payload).success) return { refused: CARD_PAYLOAD_INVALID }
    return {
        message: {
            kind: given.kind,
            intent: given.intent,
            title: given.title,
            summary: given.summary,
            payload: given.payload,
            ...(given.work === undefined ? {} : { work: given.work }),
        },
    }
}
