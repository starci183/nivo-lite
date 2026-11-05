import type { ChatbotChannel } from "./channel"

/** A Zalo user id is a string of digits; an import writes a placeholder sender in its place. */
const ZALO_USER_ID = /^\d+$/u

/** The Zalo refusals that say the customer cannot be reached at all: unknown, invalid, or not following the OA. */
const UNREACHABLE_FAILURES: ReadonlySet<string> = new Set(["zalo_recipient", "zalo_unfollowed"])

/** The customer a conversation reaches: the channel and the id the channel knows them by. */
export interface RecipientTarget {
    /** The channel of the conversation. */
    readonly channel: ChatbotChannel
    /** The customer's id on that channel, or null when it holds none. */
    readonly externalId: string | null
}

/** True when a Zalo conversation names a customer that is no Zalo user (an imported conversation's placeholder sender). */
export const placeholderRecipient = (target: RecipientTarget): boolean =>
    target.channel === "zalo" &&
    target.externalId !== null &&
    !ZALO_USER_ID.test(target.externalId.split(":", 1).join(""))

/** True when the channel refused a message because of who it was for, not because of the window, the quota or its own state. */
export const recipientRefused = (failure: string | null): boolean =>
    failure !== null && UNREACHABLE_FAILURES.has(failure)
