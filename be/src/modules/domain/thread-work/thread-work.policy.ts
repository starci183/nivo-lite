import type { ApproverGroup, RuleUnit } from "@modules/domain/authority-rules"
import type { ActionEntry, WorkEdits } from "@modules/domain/decisions"
import { formatVnd } from "@modules/domain/decisions"
import type { MentionRef } from "@modules/domain/work-chains"
import type { ProposalFieldValue } from "@modules/domain/work-items"
import type { Locale } from "@modules/platform/i18n"
import type {
    AssignedTask,
    DeciderRecord,
    MemberDecider,
    NextStep,
    StepSeed,
    WorkAgent,
    WorkAgentRecord,
    WorkLeadRecord,
} from "./thread-work.contracts"

/** The proposal field that carries an amount in each unit the rules count in. */
const AMOUNT_FIELD: Readonly<Record<RuleUnit, string>> = {
    vnd: "amount_vnd",
    percent: "amount_percent",
    count: "amount_count",
}

/** An agent row as the runtime reads it. */
export const workAgentOf = (row: WorkAgentRecord): WorkAgent => ({
    id: row.id,
    name: row.name,
    module: row.module,
    canTag: row.can_tag_agent_ids,
})

/** A member as the work engine takes their decision: the workspace owner decides as the owner, everyone else as staff. */
export const deciderOf = (row: DeciderRecord): MemberDecider => ({
    name: row.display_name,
    kind: row.role === "owner" ? "owner" : "staff",
    memberId: row.id,
})

/**
 * Who an approval ask tags: the first room of the rule's group, else its first role, else its first named member; null when the
 * rule names nobody. The approval capability decides who really may approve, whoever the tag names.
 */
export const groupMentionOf = (group: ApproverGroup): MentionRef | null => {
    const [room] = group.rooms
    if (room !== undefined) return { kind: "group", id: `room:${room}` }
    const [role] = group.roles
    if (role !== undefined) return { kind: "group", id: `role:${role}` }
    const [member] = group.members
    return member === undefined ? null : { kind: "member", id: member }
}

/** How an amount reads on an approval card: a percentage, money, or a count. */
export const amountText = (amount: number, unit: RuleUnit, locale: Locale): string => {
    if (unit === "percent") return `${amount}%`
    return unit === "vnd" ? formatVnd(amount, locale) : String(amount)
}

/** What a member hands an agent becomes the step's starting point: the customer, the amount in the rule's unit and the deal value. */
export const seedOf = (summary: string, task: AssignedTask, lead: WorkLeadRecord, unit: RuleUnit): StepSeed => {
    const fields: Record<string, ProposalFieldValue> = { customer: lead.contact_name, note: summary }
    if (task.amountVnd !== null) fields.amount_vnd = task.amountVnd
    if (task.amount !== null) fields[AMOUNT_FIELD[unit]] = task.amount
    const vnd = unit === "vnd" && task.amount !== null ? task.amount : task.amountVnd
    return { summary, amount_vnd: vnd, fields }
}

/**
 * Where a finished step goes: the first action the registry queues after it that one of the agents it may tag performs, in the
 * order of its tag list; null when no such agent exists (the work ends with the agent that finished it).
 */
export const nextStepOf = (next: ReadonlyArray<ActionEntry>, targets: ReadonlyArray<WorkAgent>): NextStep | null => {
    for (const entry of next) {
        const agent = targets.find((target) => target.module === entry.moduleKey)
        if (agent !== undefined) return { action: entry.action, agent }
    }
    return null
}

/** The answer of a member the agent asked for data: the one field it asked for, in their words; nothing when it asked for several. */
export const replyEdits = (missing: ReadonlyArray<string>, body: string): WorkEdits => {
    const [only, other] = missing
    const value = body.trim()
    return only === undefined || other !== undefined || value === "" ? {} : { fields: { [only]: value } }
}
