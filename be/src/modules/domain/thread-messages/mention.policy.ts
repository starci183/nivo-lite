import type { MentionRef } from "@modules/domain/work-chains"
import { ok, refused } from "@modules/platform/primitives"
import type { Outcome } from "@modules/platform/primitives"
import { ThreadMessagesErrorCode } from "./errors/thread-messages.error"
import { MAX_MENTIONS, MAX_QUOTE_LENGTH, MAX_QUOTES } from "./thread-messages.contracts"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GROUP = /^(role:(owner|manager|staff)|room:(executive|frontdesk|sales|marketing|care|accounting))$/

const sameMention = (first: MentionRef, second: MentionRef): boolean =>
    first.kind === second.kind && first.id === second.id

const isWellFormed = (mention: MentionRef): boolean =>
    mention.kind === "group" ? GROUP.test(mention.id) : UUID.test(mention.id)

/**
 * Judges the tags an author chose. Tags come only from this explicit list, written by a member or an agent: nothing here reads
 * the text of a message or of a quote, so words a customer wrote can never become a tag. Repeats collapse into one, a tag with
 * the wrong shape is refused before any lookup, and a message tags at most the limit.
 */
export const vetMentions = (
    mentions: ReadonlyArray<MentionRef>,
): Outcome<ReadonlyArray<MentionRef>, ThreadMessagesErrorCode> => {
    const unique = mentions.filter(
        (mention, index) => mentions.findIndex((other) => sameMention(other, mention)) === index,
    )
    if (unique.length > MAX_MENTIONS) return refused(ThreadMessagesErrorCode.TooManyMentions, { max: MAX_MENTIONS })
    const malformed = unique.find((mention) => !isWellFormed(mention))
    if (malformed !== undefined) {
        return refused(ThreadMessagesErrorCode.MentionInvalid, { kind: malformed.kind, id: malformed.id })
    }
    return ok(unique)
}

/** Judges the customer words a message quotes: a few bounded, non-empty fragments that stay data. */
export const vetQuotes = (quoted: ReadonlyArray<string>): Outcome<ReadonlyArray<string>, ThreadMessagesErrorCode> => {
    const kept = quoted.map((fragment) => fragment.trim()).filter((fragment) => fragment !== "")
    if (kept.length > MAX_QUOTES || kept.some((fragment) => fragment.length > MAX_QUOTE_LENGTH)) {
        return refused(ThreadMessagesErrorCode.QuoteInvalid)
    }
    return ok(kept)
}
