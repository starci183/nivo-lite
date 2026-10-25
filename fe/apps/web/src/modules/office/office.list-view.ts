import { leadHref } from "@/modules/routes"
import type {
    OfficeConversationRowView,
    OfficeListView,
    OfficeMentionView,
    OfficeRoomRowView,
    OfficeTaskView,
} from "@/modules/types"
import { RECENT_CUSTOMERS } from "./office.consts"
import { threadDayKey } from "./office.thread"
import type { OfficeAgent, OfficeConversationUnread, OfficeMessage, OfficeStaff, OfficeTask } from "./office.types"
import { agentAvatarOf } from "./office.words"
import type { OfficeContext, OfficeWords } from "./office.words"

/** List time: the clock today, otherwise "Yesterday" or a short date. */
export const officeListTimeOf = (iso: string, words: OfficeWords, context: OfficeContext): string =>
    threadDayKey(iso) === threadDayKey(context.nowIso) ? words.time(iso) : words.day(iso)

const lastBy = (messages: ReadonlyArray<OfficeMessage>, agentId: string): OfficeMessage | null =>
    messages.findLast((message) => message.agentId === agentId) ?? null

/** A conversation row with the instant it sorts by; the instant itself is not drawn. */
interface SortableRow {
    readonly row: OfficeConversationRowView
    readonly sortAt: string | null
}

const agentRowOf = (
    agent: OfficeAgent,
    messages: ReadonlyArray<OfficeMessage>,
    words: OfficeWords,
    context: OfficeContext,
    unread: number,
): SortableRow => {
    const said = lastBy(messages, agent.id)
    const role = words.moduleName(agent.module)
    return {
        sortAt: said?.createdAt ?? null,
        row: {
            id: agent.id,
            kind: "agent",
            label: agent.name,
            description: agent.isActive ? (said?.body ?? role) : words.t("agentPreviewPaused"),
            time: said === null ? null : officeListTimeOf(said.createdAt, words, context),
            unread,
            avatar: agentAvatarOf(agent.module, agent.name),
        },
    }
}

/** Newest activity first; rows without an instant sink, keeping their given order. */
const byRecency = (a: SortableRow, b: SortableRow): number => {
    if (a.sortAt === null) return b.sortAt === null ? 0 : 1
    if (b.sortAt === null) return -1
    return b.sortAt.localeCompare(a.sortAt)
}

/** The Hub rooms of the left column and the one on screen. */
export interface OfficeRoomListInput {
    readonly rows: ReadonlyArray<OfficeRoomRowView>
    /** The id of the room on screen ("office" for the Office room). */
    readonly selected: string
    /** The caller's unread counts of the direct conversations. */
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
    const prefix = last === null || last.authorKind === "system" ? "" : `${last.authorName}: `
    const groupPreview = last === null ? words.t("groupPreviewEmpty") : `${prefix}${last.body}`
    const sortable: ReadonlyArray<SortableRow> = [
        ...rooms.rows.map((room) => ({
            sortAt: room.sortAt,
            row: {
                id: room.id,
                kind: "group" as const,
                label: room.label,
                description: room.id === "office" && room.description === "" ? groupPreview : room.description,
                time: room.time,
                unread: room.unread,
                members: room.members ?? null,
            },
        })),
        ...context.agents.map((agent) =>
            agentRowOf(agent, messages, words, context, rooms.unread.agents.get(agent.id) ?? 0),
        ),
        ...context.leads.slice(0, RECENT_CUSTOMERS).map((lead) => ({
            sortAt: lead.createdAt,
            row: {
                id: lead.id,
                kind: "customer" as const,
                label: lead.name,
                description: lead.preview ?? words.t("customerPreviewNone"),
                time: officeListTimeOf(lead.createdAt, words, context),
                unread: rooms.unread.leads.get(lead.id) ?? 0,
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
