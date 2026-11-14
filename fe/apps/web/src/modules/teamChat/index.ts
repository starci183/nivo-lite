import { foldText } from "@/modules/installations"
import type { ChatParty, TeamChatMarkView, TeamChatMessageRow } from "@/modules/types"

/** How many mentions one message may carry. */
const MENTIONS_MAX = 20

/** The refusals of the chat doors, as data: the composer and the new-chat form say each in the viewer's words. */
type ChatRefusalCode =
    | "not_found"
    | "not_member"
    | "forbidden"
    | "direct_needs_two"
    | "group_needs_name"
    | "member_unknown"
    | "already_member"
    | "not_a_member_to_remove"
    | "last_owner"
    | "decision_not_found"
    | "not_an_approver"
    | "decision_closed"
    | "storage_unavailable"
    | "body_empty"
    | "body_too_long"
    | "too_many_mentions"
    | "too_many_files"
    | "file_too_large"
    | "file_type_not_allowed"
    | "reaction_invalid"
    | "reaction_rate_limited"

/** What the end of a draft asks for: where the `@` stands and what was typed after it. */
interface MentionTrigger {
    readonly start: number
    readonly query: string
}

/** The longest name part the trigger reads after the `@` (a longer run is text, not a name). */
const MENTION_QUERY_MAX = 30

/**
 * The mention being typed at the end of a draft: the last `@` that opens the text or follows a space, and what follows it up to
 * the end. Null when no mention is open (no `@`, a line break after it, or a run too long to be a name).
 */
export const mentionTriggerOf = (draft: string): MentionTrigger | null => {
    const at = draft.lastIndexOf("@")
    if (at < 0) return null
    if (at > 0 && !/\s/u.test(draft.charAt(at - 1))) return null
    const query = draft.slice(at + 1)
    if (query.includes("\n") || query.length > MENTION_QUERY_MAX) return null
    return { start: at, query }
}

/** How many suggestions the composer offers at once. */
const SUGGESTIONS_MAX = 6

/** The parties whose name starts a word with what was typed, the first few; every party when nothing was typed. */
export const suggestionsOf = (parties: ReadonlyArray<ChatParty>, query: string): ReadonlyArray<ChatParty> => {
    const wanted = foldText(query.trim())
    const matches = parties.filter((party) =>
        wanted === ""
            ? true
            : foldText(party.name)
                  .split(/\s+/u)
                  .some((word) => word.startsWith(wanted)) || foldText(party.name).startsWith(wanted),
    )
    return matches.slice(0, SUGGESTIONS_MAX)
}

/** The draft with the open mention replaced by the chosen party's name and a space after it. */
export const draftWithMention = (draft: string, trigger: MentionTrigger, party: ChatParty): string =>
    `${draft.slice(0, trigger.start)}@${party.name} `

/** The parties a draft names with `@name`, once each, at most the door's limit. */
export const mentionsOfDraft = (draft: string, parties: ReadonlyArray<ChatParty>): ReadonlyArray<ChatParty> => {
    const named = parties.filter((party) => draft.includes(`@${party.name}`))
    const seen = new Set<string>()
    const once = named.filter((party) => {
        const key = `${party.kind}:${party.id}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
    })
    return once.slice(0, MENTIONS_MAX)
}

/** The calendar days between a moment and now: 0 is today, 1 is yesterday. */
export const daysAgoOf = (iso: string, now: Date): number => {
    const day = (value: Date): number => Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())
    return Math.round((day(now) - day(new Date(iso))) / 86_400_000)
}

/** Whether a refusal code is one the app knows (the door may add codes later; an unknown one reads as a plain failure). */
export const isChatRefusal = (code: string): code is ChatRefusalCode =>
    [
        "not_found",
        "not_member",
        "forbidden",
        "direct_needs_two",
        "group_needs_name",
        "member_unknown",
        "already_member",
        "not_a_member_to_remove",
        "last_owner",
        "decision_not_found",
        "not_an_approver",
        "decision_closed",
        "storage_unavailable",
        "body_empty",
        "body_too_long",
        "too_many_mentions",
        "too_many_files",
        "file_too_large",
        "file_type_not_allowed",
        "reaction_invalid",
        "reaction_rate_limited",
    ].includes(code)

/** The largest file a message may carry (bytes). */
const CHAT_FILE_MAX_BYTES = 25 * 1024 * 1024

/** The kinds of file a message may carry beyond pictures: PDF, plain text and the office formats. */
const CHAT_FILE_TYPES: ReadonlySet<string> = new Set([
    "application/pdf",
    "text/plain",
    "application/msword",
    "application/vnd.ms-excel",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
])

/** The types the file picker offers: pictures and the kinds above (a hint; the door checks the bytes). */
export const CHAT_FILE_ACCEPT: string = ["image/*", ...CHAT_FILE_TYPES].join(",")

/** Why a chosen file is refused before it is sent, in the code of the door, or null when it may go. */
export const chatFileRefusalOf = (
    file: Pick<File, "size" | "type">,
): "file_type_not_allowed" | "file_too_large" | null => {
    if (!file.type.startsWith("image/") && !CHAT_FILE_TYPES.has(file.type)) return "file_type_not_allowed"
    return file.size > CHAT_FILE_MAX_BYTES ? "file_too_large" : null
}

/** The key a party is picked by in a form: its kind and id. */
export const partyKeyOf = (party: ChatParty): string => `${party.kind}:${party.id}`

/** The party a picked key names, among the parties offered; undefined when none matches. */
export const partyOfKey = (key: string, parties: ReadonlyArray<ChatParty>): ChatParty | undefined =>
    parties.find((party) => partyKeyOf(party) === key)
export { agentCardOf } from "./agentCard"
export { agentMessageWordsOf } from "./agentWords"
export { stopPreviewNodeOf, stopPreviewOf } from "./stopPreview"
export { NIVO_MARK, backgroundStoppedViewOf } from "./backgroundStopped"
export type { BackgroundStoppedWords } from "./backgroundStopped"
export { brainChangeViewOf } from "./brainChange"
export { quoteOf } from "./quote"
export type { BrainChangeWords } from "./brainChange"
export { stopCardViewOf } from "./stopCard"
export type { StopCardWords } from "./stopCard"
export { groupPositionsOf } from "./grouping"
export type { GroupItem, GroupPosition } from "./grouping"
export { createPendingTaps, createReactionBatcher, withPendingTaps } from "./reactions"
export type { PendingTaps, ReactionBatch } from "./reactions"

/** The mark of the sender of a message, as the thread draws it beside a bubble and a card: the agent's picture or the person's avatar. */
export const chatMarkOf = (row: TeamChatMessageRow): TeamChatMarkView => ({
    kind: row.author?.kind ?? "user",
    id: row.author?.id ?? row.id,
    name: row.authorName,
    picture: row.author?.picture ?? null,
})
