import type { BodySegment } from "@/modules/types"

/** A tag as the thread names it. */
export interface BodyMention {
    readonly kind: string
    readonly name: string
}

/** The earliest tag whose `@name` appears in the text, preferring the longer name on a tie. */
const nextMention = (
    text: string,
    mentions: ReadonlyArray<BodyMention>,
): { readonly at: number; readonly mention: BodyMention } | null =>
    mentions.reduce<{ readonly at: number; readonly mention: BodyMention } | null>((best, mention) => {
        const at = text.indexOf(`@${mention.name}`)
        if (at < 0) return best
        if (best === null || at < best.at) return { at, mention }
        return at === best.at && mention.name.length > best.mention.name.length ? { at, mention } : best
    }, null)

/**
 * Splits a message into text and chips. Only the tags the author chose become chips (a customer quote is never split), and
 * only where the text names them with an at sign; the rest stays text. Each run carries its offset in the message.
 */
export const bodySegmentsOf = (
    text: string,
    mentions: ReadonlyArray<BodyMention>,
    from = 0,
): ReadonlyArray<BodySegment> => {
    const found = nextMention(text, mentions)
    if (found === null) return text === "" ? [] : [{ kind: "text", offset: from, text }]
    const before: ReadonlyArray<BodySegment> =
        found.at === 0 ? [] : [{ kind: "text", offset: from, text: text.slice(0, found.at) }]
    const chip: BodySegment = { kind: "mention", offset: from + found.at, name: found.mention.name }
    const used = found.at + 1 + found.mention.name.length
    return [...before, chip, ...bodySegmentsOf(text.slice(used), mentions, from + used)]
}
