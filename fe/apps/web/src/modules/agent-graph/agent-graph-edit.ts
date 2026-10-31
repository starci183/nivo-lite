import type {
    AgentGraphBranchData,
    AgentGraphBranchForm,
    AgentGraphChangeLine,
    AgentGraphMemberData,
    AgentGraphOnTimeout,
    AgentGraphRight,
    AgentGraphThen,
} from "@/modules/types"

/** How open an action is: stopping is the strictest and running alone the most open. */
const REACH: Readonly<Record<AgentGraphThen, number>> = { stop: 0, ask: 1, auto: 2 }

/** The form of a branch as the editor opens it; a bound of 0 means the branch has none. */
export const branchFormOf = (branch: AgentGraphBranchData): AgentGraphBranchForm => ({
    fromVnd: branch.fromVnd ?? 0,
    toVnd: branch.toVnd ?? 0,
    then: branch.then,
    approverId: branch.approver?.memberId ?? "",
    timeoutHours: Math.round((branch.approver?.timeoutMinutes ?? 240) / 60),
    onTimeout: branch.approver?.onTimeout ?? "unset",
    backupId: branch.approver?.backupId ?? "",
})

/** Whether the chosen approver may approve up to the top of the branch: the check that stops a card going to nobody. */
export const rightOf = (form: AgentGraphBranchForm, members: ReadonlyArray<AgentGraphMemberData>): AgentGraphRight => {
    if (form.then !== "ask") return "none"
    const member = members.find((entry) => entry.id === form.approverId)
    if (member === undefined) return "missing"
    if (member.upToVnd === null) return "covers"
    if (form.toVnd === 0) return "short"
    return member.upToVnd >= form.toVnd ? "covers" : "short"
}

/** What changed between a branch and its form, one line per kind; empty when nothing did. */
export const changesOf = (
    branch: AgentGraphBranchData,
    form: AgentGraphBranchForm,
    members: ReadonlyArray<AgentGraphMemberData>,
    amountOf: (value: number) => string,
): ReadonlyArray<AgentGraphChangeLine> => {
    const before = branchFormOf(branch)
    const nameOf = (id: string): string => members.find((entry) => entry.id === id)?.name ?? ""
    const lines: Array<AgentGraphChangeLine> = []
    if (before.fromVnd !== form.fromVnd || before.toVnd !== form.toVnd) {
        lines.push({
            kind: "bounds",
            before: `${amountOf(before.fromVnd)} - ${amountOf(before.toVnd)}`,
            after: `${amountOf(form.fromVnd)} - ${amountOf(form.toVnd)}`,
        })
    }
    if (before.then !== form.then) lines.push({ kind: "then", before: before.then, after: form.then })
    if (before.approverId !== form.approverId) {
        lines.push({ kind: "approver", before: nameOf(before.approverId), after: nameOf(form.approverId) })
    }
    const isTimeoutChanged =
        before.timeoutHours !== form.timeoutHours ||
        before.onTimeout !== form.onTimeout ||
        before.backupId !== form.backupId
    if (isTimeoutChanged)
        lines.push({ kind: "timeout", before: `${before.timeoutHours}`, after: `${form.timeoutHours}` })
    return lines
}

/** The top of a branch as a number to compare: a branch with no top reaches without end. */
const topOf = (value: number | null): number => (value === null || value === 0 ? Number.POSITIVE_INFINITY : value)

/**
 * Whether the form gives the agent more reach than the branch had: a branch moved toward running alone, or an auto branch whose top
 * rose. Only the owner may publish that (section 15.8); a manager may publish a tightening.
 */
export const isWideningOf = (branch: AgentGraphBranchData, form: AgentGraphBranchForm): boolean => {
    if (REACH[form.then] > REACH[branch.then]) return true
    return form.then === "auto" && topOf(form.toVnd) > topOf(branch.toVnd)
}

/** Whether the form can be saved to the draft: the bounds do not cross, and a branch that asks names a person who may approve its top. */
export const isFormSavable = (form: AgentGraphBranchForm, members: ReadonlyArray<AgentGraphMemberData>): boolean => {
    const isOrdered = form.toVnd === 0 || form.fromVnd < form.toVnd
    const isTimedOut = form.then !== "ask" || form.onTimeout !== "unset"
    const right = rightOf(form, members)
    return isOrdered && isTimedOut && right !== "short" && right !== "missing"
}

const THENS: ReadonlyArray<AgentGraphThen> = ["auto", "ask", "stop"]
const TIMEOUTS: ReadonlyArray<AgentGraphOnTimeout> = ["backup", "stop", "agent_owner", "unset"]

/** The form with one field set; a value of the wrong kind for the field changes nothing. */
export const withField = (
    form: AgentGraphBranchForm,
    name: keyof AgentGraphBranchForm,
    value: string | number,
): AgentGraphBranchForm => {
    if (typeof value === "number") {
        if (name === "fromVnd") return { ...form, fromVnd: value }
        if (name === "toVnd") return { ...form, toVnd: value }
        return name === "timeoutHours" ? { ...form, timeoutHours: value } : form
    }
    if (name === "approverId") return { ...form, approverId: value }
    if (name === "backupId") return { ...form, backupId: value }
    const then = THENS.find((entry) => entry === value)
    if (name === "then" && then !== undefined) return { ...form, then }
    const onTimeout = TIMEOUTS.find((entry) => entry === value)
    return name === "onTimeout" && onTimeout !== undefined ? { ...form, onTimeout } : form
}
