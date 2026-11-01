import { leadHref } from "@/modules/routes"
import type {
    OfficeConversationRowView,
    OfficeConversationState,
    OfficeListView,
    OfficeMentionView,
    OfficeRoomRowView,
    OfficeTaskView,
} from "@/modules/types"
import { RECENT_CUSTOMERS } from "./office.consts"
import { NO_CONVERSATION_STATE, unreadBadgeOf } from "./office.conversation-state"
import { zaloTimeOf } from "./office.list-time"
import { officePreviewOf, previewKindOf } from "./office.preview"
import type {
    OfficeAgent,
    OfficeAgentConversation,
    OfficeAgentLine,
    OfficeConversationUnread,
    OfficeMessage,
    OfficeStaff,
    OfficeTask,
} from "./office.types"
import { agentAvatarOf, offDutyOf } from "./office.words"
import type { OfficeContext, OfficeWords } from "./office.words"

/** List time as Zalo draws it: "Just now", "N min", "N h", "Yesterday", "N days", then dd/MM. */
export const officeListTimeOf = (iso: string, words: OfficeWords, context: OfficeContext): string =>
    zaloTimeOf(iso, context.nowIso, words)

/** The unread and state fields every row carries, from the unread count and the flags of the source. */
const rowStateOf = (unread: number, state: OfficeConversationState) => ({
    unread,
    isUnread: unread > 0,
    badge: unreadBadgeOf(unread, state),
    isLastSeen: state.isLastSeen,
    isTyping: state.isTyping,
})

/** The preview of a row: "typing" while someone types, otherwise the given one-line preview. */
const previewWhileTyping = (isTyping: boolean, preview: string, words: OfficeWords): string =>
    isTyping ? words.t("previewTyping") : preview

/** A conversation row with the instant it sorts by; the instant itself is not drawn. */
interface SortableRow {
    readonly row: OfficeConversationRowView
    readonly sortAt: string | null
}

/** The preview of an agent row: its direct conversation's last line, else its role; an agent that is not on duty says why (paused, needs setup, waits for a connection). */
const agentPreviewOf = (
    agent: OfficeAgent,
    last: OfficeAgentLine | null,
    role: string,
    words: OfficeWords,
    context: OfficeContext,
): string => {
    if (!agent.isActive) return offDutyOf(agent, words)
    if (last === null) return role
    return officePreviewOf(
        { kind: "text", body: last.body, author: last.author, authorUserId: last.authorId },
        { userId: context.meUserId, name: context.meName },
        words,
    )
}

const agentRowOf = (
    agent: OfficeAgent,
    conversation: OfficeAgentConversation | undefined,
    words: OfficeWords,
    context: OfficeContext,
): SortableRow => {
    const last = conversation?.last ?? null
    const role = words.moduleName(agent.module)
    return {
        sortAt: last?.at ?? null,
        row: {
            id: agent.id,
            kind: "agent",
            label: agent.name,
            description: agentPreviewOf(agent, last, role, words, context),
            time: last === null ? null : officeListTimeOf(last.at, words, context),
            ...rowStateOf(conversation?.unread ?? 0, NO_CONVERSATION_STATE),
            avatar: agentAvatarOf(agent),
        },
    }
}

/** Newest activity first, by instant (sources format ISO times differently); rows without an instant sink, keeping their given order. */
const byRecency = (a: SortableRow, b: SortableRow): number => {
    if (a.sortAt === null) return b.sortAt === null ? 0 : 1
    if (b.sortAt === null) return -1
    return Date.parse(b.sortAt) - Date.parse(a.sortAt)
}

/** The Hub rooms of the left column and the one on screen. */
export interface OfficeRoomListInput {
    readonly rows: ReadonlyArray<OfficeRoomRowView>
    /** The id of the room on screen ("office" for the Office room). */
    readonly selected: string
    /** The caller's direct conversations: every agent conversation, and the unread customer ones. */
    readonly unread: OfficeConversationUnread
}

/** The left column: one conversation list — the rooms, the agents and the recent customers, newest first. */
export const officeListViewOf = (
    messages: ReadonlyArray<OfficeMessage>,
    pendingCount: number,
    words: OfficeWords,
    context: OfficeContext,
    rooms: OfficeRoomListInput,
): OfficeListView => {
    const last = messages.at(-1) ?? null
    const groupPreview =
        last === null
            ? words.t("groupPreviewEmpty")
            : officePreviewOf(
                  {
                      kind: previewKindOf(last),
                      body: last.body,
                      author: last.authorKind === "system" ? null : last.authorName,
                      authorUserId: last.authorUserId,
                  },
                  { userId: context.meUserId, name: context.meName },
                  words,
              )
    const sortable: ReadonlyArray<SortableRow> = [
        ...rooms.rows.map((room) => ({
            sortAt: room.sortAt,
            row: {
                id: room.id,
                kind: "group" as const,
                label: room.label,
                description: previewWhileTyping(
                    room.state.isTyping,
                    room.id === "office" && room.description === "" ? groupPreview : room.description,
                    words,
                ),
                time: room.time,
                ...rowStateOf(room.unread, room.state),
                members: room.members ?? null,
            },
        })),
        ...context.agents.map((agent) => agentRowOf(agent, rooms.unread.agents.get(agent.id), words, context)),
        ...context.leads.slice(0, RECENT_CUSTOMERS).map((lead) => ({
            sortAt: lead.createdAt,
            row: {
                id: lead.id,
                kind: "customer" as const,
                label: lead.name,
                description: lead.preview ?? words.t("customerPreviewNone"),
                time: officeListTimeOf(lead.createdAt, words, context),
                ...rowStateOf(rooms.unread.leads.get(lead.id) ?? 0, NO_CONVERSATION_STATE),
                avatar: { kind: "person" as const, name: lead.name },
            },
        })),
    ]
    return {
        conversations: sortable
            .slice()
            .sort(byRecency)
            .map((entry) => entry.row),
        selectedRoom: rooms.selected,
        pendingCount,
    }
}

/** The task rows. */
export const taskViewsOf = (tasks: ReadonlyArray<OfficeTask>, words: OfficeWords): ReadonlyArray<OfficeTaskView> =>
    tasks.map((task) => ({
        id: task.id,
        title: task.title,
        status: task.status,
        nextAction: task.nextAction,
        owner: task.ownerName,
        meta: words.t("taskMeta", {
            lead: task.leadName,
            owner: task.ownerName,
            due: task.dueAt === null ? words.t("noDue") : words.t("due", { date: words.day(task.dueAt) }),
        }),
        leadHref: leadHref(task.leadId),
    }))

/** The @mention list of the composer: NIVO, the active agents and the staff. */
export const mentionOptionsOf = (
    agents: ReadonlyArray<OfficeAgent>,
    staff: ReadonlyArray<OfficeStaff>,
    handles: ReadonlyMap<string, string>,
    words: OfficeWords,
): ReadonlyArray<OfficeMentionView> => [
    { id: "nivo", label: "nivo", description: `${words.t("nivoCore")} · ${words.t("nivoRole")}` },
    ...agents
        .filter((agent) => agent.isActive)
        .map((agent) => ({
            id: `agent-${agent.id}`,
            label: agent.handle,
            description: `${agent.name} · ${words.moduleName(agent.module)}`,
        })),
    ...staff.map((member) => ({
        id: `staff-${member.id}`,
        label: handles.get(member.id) ?? "",
        description: `${member.name} · ${member.role === "" ? words.t("staffTag") : member.role}`,
    })),
]
