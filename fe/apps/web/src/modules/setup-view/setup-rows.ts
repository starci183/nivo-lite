import { groupPositionsOf } from "@/modules/teamChat"
import type { GroupItem } from "@/modules/teamChat"
import type { SetupWrite, TeamChatMessageRow } from "@/modules/types"
import type { setupThreadOf } from "./setup-thread"

/** The party that is not the reader: NIVO, the one agent of the setup chat. */
const NIVO = { kind: "agent", id: "nivo", name: "NIVO", picture: null } as const

/** The words and the clock the rows need from the person's language. */
interface SetupRowWords {
    /** The name of the reader's own bubbles' author. */
    readonly you: string
    readonly nivo: string
    /** The time of day of a message, from its ISO moment. */
    readonly timeOf: (iso: string) => string
}

/** The rows of the setup chat in the shared view model, and the confirm cards that stand under a message. */
export interface SetupRows {
    readonly rows: ReadonlyArray<TeamChatMessageRow>
    /** The confirm cards of the facts NIVO wants to write, by the id of the reply they stand under. */
    readonly writes: Readonly<Record<string, ReadonlyArray<SetupWrite>>>
    /** The newest reply of NIVO, under which the proposals stand; empty before NIVO answered. */
    readonly latestReplyId: string
}

/** A message that is not a bubble of a person: a line between revisions. */
const systemRowOf = (id: string, text: string): TeamChatMessageRow => ({
    id,
    kind: "system",
    side: "incoming",
    author: null,
    authorName: "",
    body: text,
    timeLabel: "",
    dayLabel: null,
    pinned: false,
    files: [],
    workHref: null,
    approval: null,
    card: null,
    reactions: [],
    replyTo: null,
    forwardedFrom: null,
    groupPosition: "single",
})

/**
 * Adapts the messages of the setup session (its own back end session, not a room of the team chat) to the rows the shared chat
 * thread draws: the reader's words at the end, NIVO's at the start with its mark, a line where an applied revision closes, and the
 * Messenger run position of each bubble. Nothing here is a room: no pin, no reaction, no files.
 */
export const setupRowsOf = (groups: ReturnType<typeof setupThreadOf>, words: SetupRowWords): SetupRows => {
    const entries = groups.flatMap((group) => [
        ...group.messages.map(({ message, cards }) => ({ kind: "message" as const, message, cards })),
        ...(group.divider === "" ? [] : [{ kind: "divider" as const, id: `${group.id}:divider`, text: group.divider }]),
    ])
    const items: ReadonlyArray<GroupItem> = entries.map((entry) =>
        entry.kind === "divider"
            ? { sender: null, at: 0, startsDay: false }
            : {
                  sender: entry.message.role === "user" ? "user:me" : "agent:nivo",
                  at: new Date(entry.message.createdAt).getTime(),
                  startsDay: false,
              },
    )
    const positions = groupPositionsOf(items)
    const rows = entries.map((entry, index): TeamChatMessageRow => {
        if (entry.kind === "divider") return systemRowOf(entry.id, entry.text)
        const { message } = entry
        const isOwner = message.role === "user"
        return {
            ...systemRowOf(message.id, ""),
            kind: "text",
            side: isOwner ? "outgoing" : "incoming",
            author: isOwner ? null : NIVO,
            authorName: isOwner ? message.author || words.you : words.nivo,
            body: message.body,
            timeLabel: words.timeOf(message.createdAt),
            groupPosition: positions[index] ?? "single",
        }
    })
    const messages = entries.flatMap((entry) => (entry.kind === "message" ? [entry] : []))
    return {
        rows,
        writes: Object.fromEntries(
            messages.filter((entry) => entry.cards.length > 0).map((entry) => [entry.message.id, entry.cards]),
        ),
        latestReplyId: messages.findLast((entry) => entry.message.role === "assistant")?.message.id ?? "",
    }
}
