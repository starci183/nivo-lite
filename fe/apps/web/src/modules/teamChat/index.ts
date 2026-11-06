import { foldText } from "@/modules/installations"

/** What a person answers an approval card with. */
export type TeamChatVerdict = "approved" | "refused"

/** How many messages one page of a thread holds. */
export const CHAT_PAGE_SIZE = 30

/** How many mentions one message may carry. */
const MENTIONS_MAX = 20

/** Who a room member, a message author or a mention is. */
export type ChatPartyKind = "user" | "agent"

/** A person or an agent the composer may mention, or the new-chat form may pick. */
export interface ChatParty {
    readonly kind: ChatPartyKind
    readonly id: string
    readonly name: string
}

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
        wanted === "" ? true : foldText(party.name).split(/\s+/u).some((word) => word.startsWith(wanted)) || foldText(party.name).startsWith(wanted),
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
    ].includes(code)

/** One room of the list, with every word resolved. */
export interface TeamChatRoomRow {
    readonly id: string
    readonly kind: "direct" | "group"
    readonly title: string
    /** Who the room is with when it is direct (the mark it wears); null for a group. */
    readonly other: ChatParty | null
    /** The last message in one line (author and text), or the empty line. */
    readonly preview: string
    /** The time of the last message in the short form, or empty. */
    readonly when: string
    readonly unread: number
    readonly mentions: number
    readonly isSelected: boolean
}

/** The state of the decision a card carries. */
export type TeamChatApprovalStatus = "pending" | "approved" | "refused" | "expired"

/** The approval card of a message: one decision, the same one the workbench pane shows. */
export interface TeamChatApprovalView {
    readonly decisionId: string
    readonly status: TeamChatApprovalStatus
    /** Who settled it, empty while pending. */
    readonly decidedBy: string
    readonly decidedAt: string
    /** The viewer holds the right the decide door checks. */
    readonly canDecide: boolean
}

/** One file under a message. */
interface TeamChatFileView {
    readonly id: string
    readonly name: string
    readonly contentType: string
    readonly url: string
}

/** One message of the open thread, with every word resolved. */
export interface TeamChatMessageRow {
    readonly id: string
    readonly kind: "text" | "report" | "approval" | "system"
    readonly side: "outgoing" | "incoming"
    readonly author: ChatParty | null
    readonly authorName: string
    readonly body: string
    readonly timeLabel: string
    /** The day it opens when it is the first of its day, else null: the thread draws a divider before it. */
    readonly dayLabel: string | null
    readonly pinned: boolean
    readonly files: ReadonlyArray<TeamChatFileView>
    /** The agent run a report belongs to, or null. */
    readonly reportRunId: string | null
    readonly approval: TeamChatApprovalView | null
}

/** The key a party is picked by in a form: its kind and id. */
export const partyKeyOf = (party: ChatParty): string => `${party.kind}:${party.id}`

/** The party a picked key names, among the parties offered; undefined when none matches. */
export const partyOfKey = (key: string, parties: ReadonlyArray<ChatParty>): ChatParty | undefined =>
    parties.find((party) => partyKeyOf(party) === key)
