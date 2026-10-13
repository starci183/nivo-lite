import { leadHref } from "@/modules/routes"
import type { OfficeChatRowView, OfficeListView, OfficeMentionView, OfficeTaskView } from "@/modules/types"
import { RECENT_CUSTOMERS } from "./office.consts"
import { threadDayKey } from "./office.thread"
import type { OfficeAgent, OfficeMessage, OfficeStaff, OfficeTask } from "./office.types"
import { agentAvatarOf } from "./office.words"
import type { OfficeContext, OfficeWords } from "./office.words"

/** List time: the clock today, otherwise "Yesterday" or a short date. */
const listTimeOf = (iso: string, words: OfficeWords, context: OfficeContext): string =>
    threadDayKey(iso) === threadDayKey(context.nowIso) ? words.time(iso) : words.day(iso)

const lastBy = (messages: ReadonlyArray<OfficeMessage>, agentId: string): OfficeMessage | null =>
    messages.findLast((message) => message.agentId === agentId) ?? null

const agentRowOf = (
    agent: OfficeAgent,
    messages: ReadonlyArray<OfficeMessage>,
    words: OfficeWords,
    context: OfficeContext,
): OfficeChatRowView => {
    const said = lastBy(messages, agent.id)
    const role = words.moduleName(agent.module)
    return {
        id: agent.id,
        label: agent.name,
        description: agent.isActive ? (said?.body ?? role) : words.t("agentPreviewPaused"),
        time: said === null ? null : listTimeOf(said.createdAt, words, context),
        avatar: agentAvatarOf(agent.module, agent.name),
    }
}

/** The left column: the group, the agents and the recent customers. */
export const officeListViewOf = (
    messages: ReadonlyArray<OfficeMessage>,
    pendingCount: number,
    words: OfficeWords,
    context: OfficeContext,
): OfficeListView => {
    const last = messages.at(-1) ?? null
    const prefix = last === null || last.authorKind === "system" ? "" : `${last.authorName}: `
    return {
        groupLabel: words.t("title"),
        groupPreview: last === null ? words.t("groupPreviewEmpty") : `${prefix}${last.body}`,
        groupTime: last === null ? null : listTimeOf(last.createdAt, words, context),
        pendingCount,
        agents: context.agents.map((agent) => agentRowOf(agent, messages, words, context)),
        customers: context.leads.slice(0, RECENT_CUSTOMERS).map((lead) => ({
            id: lead.id,
            label: lead.name,
            description: lead.preview ?? words.t("customerPreviewNone"),
            time: listTimeOf(lead.createdAt, words, context),
            avatar: { kind: "person", name: lead.name },
        })),
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
