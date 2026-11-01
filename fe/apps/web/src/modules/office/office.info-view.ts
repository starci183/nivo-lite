import { AGENTS_ROUTE, CONSOLE_ROUTES, agentChatHref } from "@/modules/routes"
import type {
    OfficeChannelRowView,
    OfficeInfoView,
    OfficeJumpRowView,
    OfficeMemberRowView,
    OfficePinRowView,
    OfficeWaitingRowView,
} from "@/modules/types"
import { isDecisionWork, waitingOf } from "./office.helpers"
import type { OfficeAgent, OfficeApproval, OfficePerson, OfficeStaff, OfficeTask, OfficeWork } from "./office.types"
import { NIVO_AVATAR, agentAvatarOf, avatarOfAgentId, departmentAgentOf, leadNameOf, offDutyOf } from "./office.words"
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

/** The reason of a drafted reply followed by the customer words it answers, so the rows of one list can be told apart. */
const askedLineOf = (work: OfficeWork, reason: string): string =>
    work.draft === null || work.draft === "" || work.summary === "" ? reason : `${reason} · “${work.summary}”`

const workJumpOf = (work: OfficeWork, words: OfficeWords, context: OfficeContext): OfficeJumpRowView => {
    const agent = departmentAgentOf(context, work.department)
    const lead = leadNameOf(context, work.leadId)
    const action = words.actionWord(work.action)
    return {
        id: work.id,
        title: lead === null ? action : [action, lead].join(" · "),
        subtitle: askedLineOf(work, work.reason === null ? words.g("status_failed") : words.g(`reason_${work.reason}`)),
        avatar: agent === null ? NIVO_AVATAR : agentAvatarOf(agent),
    }
}

/** The rows of "Needs your approval" in the order the header chip counts and jumps them (oldest first). */
const waitingRowsOf = (
    pending: ReadonlyArray<OfficeApproval>,
    openWork: ReadonlyArray<OfficeWork>,
    words: OfficeWords,
    context: OfficeContext,
): ReadonlyArray<OfficeWaitingRowView> => {
    const approvals = new Map(pending.map((approval) => [approval.id, approval]))
    const works = new Map(openWork.map((work) => [work.id, work]))
    return waitingOf(pending, openWork).flatMap((waiting): ReadonlyArray<OfficeWaitingRowView> => {
        const approval = waiting.kind === "approval" ? approvals.get(waiting.id) : undefined
        if (approval !== undefined) return [{ ...approvalJumpOf(approval, words, context), target: "approval" }]
        const work = waiting.kind === "exception" ? works.get(waiting.id) : undefined
        return work === undefined ? [] : [{ ...workJumpOf(work, words, context), target: "exception" }]
    })
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
        avatar: { kind: "person", name: person.name, src: person.avatarUrl },
        isMe,
        presence: null,
        mention: handle === null || isMe ? null : handle,
        chatHref: null,
        note: null,
        noteAction: null,
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
    noteAction: null,
})

/** What a waiting agent waits for: one line per missing role, with the connectors the back end names (data, never fixed). */
const waitsForOf = (agent: OfficeAgent, words: OfficeWords): string | null =>
    agent.waitsFor === null
        ? null
        : agent.waitsFor
              .map((need) =>
                  need.providers.length === 0
                      ? words.t("needsRole", { role: need.role })
                      : words.t("needsConnection", { providers: need.providers.join(words.t("providersOr")) }),
              )
              .join(" · ")

const agentMemberOf = (agent: OfficeAgent, words: OfficeWords): OfficeMemberRowView => ({
    id: agent.id,
    name: agent.name,
    detail: agent.isActive ? `@${agent.handle} · ${words.moduleName(agent.module)}` : offDutyOf(agent, words),
    seen: null,
    avatar: agentAvatarOf(agent),
    isMe: false,
    presence: agent.isActive ? words.t("onDuty") : null,
    mention: agent.isActive ? agent.handle : null,
    chatHref: agentChatHref(agent.id),
    note: waitsForOf(agent, words),
    noteAction:
        agent.waitsFor === null ? null : { label: words.t("openConnections"), href: CONSOLE_ROUTES.connections },
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

/** The board rows the right column reads: what waits, who is in the chat, their handles and the tasks. */
export interface OfficeInfoSources {
    readonly pending: ReadonlyArray<OfficeApproval>
    readonly openWork: ReadonlyArray<OfficeWork>
    readonly people: ReadonlyArray<OfficePerson>
    /** The @handle of each staff row, by staff id. */
    readonly handles: ReadonlyMap<string, string>
    readonly tasks: ReadonlyArray<OfficeTask>
}

/** The right column: what waits, who is in the chat and the tasks summary. */
export const infoViewOf = (
    sources: OfficeInfoSources,
    words: OfficeWords,
    context: OfficeContext,
    room: OfficeRoomInfoInput,
): OfficeInfoView => {
    const { pending, openWork, people, handles, tasks } = sources
    const linked = new Set(people.map((person) => person.staffId))
    const unlinked = room.isOffice ? context.staff.filter((member) => !linked.has(member.id)) : []
    return {
        cards: room.cards,
        channels: room.channels,
        pins: room.pins,
        approvals: waitingRowsOf(pending, openWork, words, context),
        exceptions: openWork.filter((work) => !isDecisionWork(work)).map((work) => workJumpOf(work, words, context)),
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
