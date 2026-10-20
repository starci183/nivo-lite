import { AGENTS_ROUTE, agentChatHref } from "@/modules/routes"
import type {
    OfficeChannelRowView,
    OfficeInfoView,
    OfficeJumpRowView,
    OfficeMemberRowView,
    OfficePinRowView,
} from "@/modules/types"
import type { OfficeAgent, OfficeApproval, OfficePerson, OfficeStaff, OfficeTask, OfficeWork } from "./office.types"
import { NIVO_AVATAR, agentAvatarOf, avatarOfAgentId, departmentAgentOf, leadNameOf } from "./office.words"
import type { OfficeContext, OfficeWords } from "./office.words"

const ONLINE_MS = 15 * 60_000
const MINUTE_MS = 60_000

const approvalJumpOf = (approval: OfficeApproval, words: OfficeWords, context: OfficeContext): OfficeJumpRowView => {
    const agent = approval.agentName ?? words.t("agentFallback")
    const lead = approval.leadName ?? words.t("unknownLead")
    return {
        id: approval.id,
        title: approval.nextAction === "" ? lead : approval.nextAction,
        subtitle: `${agent} · ${lead}`,
        avatar: avatarOfAgentId(context, approval.agentId, agent),
    }
}

const workJumpOf = (work: OfficeWork, words: OfficeWords, context: OfficeContext): OfficeJumpRowView => {
    const agent = departmentAgentOf(context, work.department)
    const lead = leadNameOf(context, work.leadId)
    const action = words.g(`action_${work.action}`)
    return {
        id: work.id,
        title: lead === null ? action : [action, lead].join(" · "),
        subtitle: work.reason === null ? words.g("status_failed") : words.g(`reason_${work.reason}`),
        avatar: agent === null ? NIVO_AVATAR : agentAvatarOf(agent.module, agent.name),
    }
}

const seenOf = (person: OfficePerson, words: OfficeWords, context: OfficeContext): string => {
    if (person.lastSeen === null) return words.t("neverSeen")
    const ago = new Date(context.nowIso).getTime() - new Date(person.lastSeen).getTime()
    if (ago < ONLINE_MS) return words.t("seenNow")
    if (ago < 60 * MINUTE_MS) return words.t("seenMinutes", { n: Math.max(1, Math.round(ago / MINUTE_MS)) })
    return words.t("seenAt", { time: words.stamp(person.lastSeen) })
}

const roleLabelOf = (role: OfficePerson["role"], words: OfficeWords): string => {
    if (role === "owner") return words.t("owner")
    return words.t(role === "manager" ? "roleManager" : "staffTag")
}

const personRowOf = (
    person: OfficePerson,
    handle: string | null,
    words: OfficeWords,
    context: OfficeContext,
): OfficeMemberRowView => {
    const isMe = person.userId === context.meUserId
    return {
        id: person.userId,
        name: person.name,
        detail: [roleLabelOf(person.role, words), handle === null ? null : `@${handle}`].filter(Boolean).join(" · "),
        seen: isMe ? null : seenOf(person, words, context),
        avatar: { kind: "person", name: person.name },
        isMe,
        presence: null,
        mention: handle === null || isMe ? null : handle,
        chatHref: null,
        note: null,
    }
}

const staffRowOf = (member: OfficeStaff, handle: string, words: OfficeWords): OfficeMemberRowView => ({
    id: member.id,
    name: member.name,
    detail: `@${handle} · ${member.role === "" ? words.t("staffTag") : member.role}`,
    seen: null,
    avatar: { kind: "person", name: member.name },
    isMe: false,
    presence: null,
    mention: handle,
    chatHref: null,
    note: words.t("noAccountYet"),
})

const agentMemberOf = (agent: OfficeAgent, words: OfficeWords): OfficeMemberRowView => ({
    id: agent.id,
    name: agent.name,
    detail: agent.isActive ? `@${agent.handle} · ${words.moduleName(agent.module)}` : words.t("paused"),
    seen: null,
    avatar: agentAvatarOf(agent.module, agent.name),
    isMe: false,
    presence: agent.isActive ? words.t("onDuty", { name: agent.name }) : null,
    mention: agent.isActive ? agent.handle : null,
    chatHref: agentChatHref(agent.id),
    note: null,
})

/** What the right column shows about the room on screen. */
export interface OfficeRoomInfoInput {
    /** True for the Office room (every member and every staff row). */
    readonly isOffice: boolean
    /** The agents seated in the room. */
    readonly agents: ReadonlyArray<OfficeAgent>
    readonly cards: ReadonlyArray<OfficeJumpRowView>
    readonly channels: ReadonlyArray<OfficeChannelRowView>
    readonly pins: ReadonlyArray<OfficePinRowView>
}

/** The right column: what waits, who is in the chat and the tasks summary. */
export const infoViewOf = (
    pending: ReadonlyArray<OfficeApproval>,
    openWork: ReadonlyArray<OfficeWork>,
    people: ReadonlyArray<OfficePerson>,
    handles: ReadonlyMap<string, string>,
    tasks: ReadonlyArray<OfficeTask>,
    words: OfficeWords,
    context: OfficeContext,
    room: OfficeRoomInfoInput,
): OfficeInfoView => {
    const linked = new Set(people.map((person) => person.staffId))
    const unlinked = room.isOffice ? context.staff.filter((member) => !linked.has(member.id)) : []
    return {
        cards: room.cards,
        channels: room.channels,
        pins: room.pins,
        approvals: pending.map((approval) => approvalJumpOf(approval, words, context)),
        exceptions: openWork.map((work) => workJumpOf(work, words, context)),
        members: [
            ...people.map((person) =>
                personRowOf(
                    person,
                    person.staffId === null ? null : (handles.get(person.staffId) ?? null),
                    words,
                    context,
                ),
            ),
            ...unlinked.map((member) => staffRowOf(member, handles.get(member.id) ?? "", words)),
            ...room.agents.map((agent) => agentMemberOf(agent, words)),
        ],
        addAgentHref: AGENTS_ROUTE,
        tasksSummary: words.t("tasksSummary", {
            open: tasks.filter((task) => task.status !== "done").length,
            total: tasks.length,
        }),
    }
}
