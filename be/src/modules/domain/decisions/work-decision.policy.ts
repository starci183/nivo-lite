import type { WorkspaceMember } from "@modules/domain/workspace-members"
import type { Decider, WorkItem } from "./decisions.contracts"
import type { DecisionAssignee, OptionalNote } from "./work-decision.contracts"

/** The fewest characters of the written basis that confirms a payment. */
export const BASIS_MIN_CHARS = 10

/** Actions whose approval must carry a written basis: a matching amount alone is not evidence. */
const NEEDS_BASIS = new Set(["reconcile_payment"])

/** Who a decision is recorded as: the member's own name; staff accounts are `staff`, owner and manager are `owner`. */
export const deciderOf = (member: WorkspaceMember): Decider => ({
    name: member.displayName,
    kind: member.role === "staff" ? "staff" : "owner",
})

/** The part of an item that says who may decide it: staff only when a staff member is assigned. */
export const assigneeOf = (item: Pick<WorkItem, "assigned_staff_id">): DecisionAssignee => ({
    assigneeKind: item.assigned_staff_id === null ? null : "staff",
    assigneeId: item.assigned_staff_id,
})

/** The basis the person wrote with its spaces collapsed; empty when none. */
export const cleanBasis = (raw: OptionalNote): string => (raw ?? "").trim().replace(/\s+/g, " ")

/** True when the action needs a written basis to be approved and the one given is too short. */
export const basisMissing = (action: string, basis: string): boolean =>
    NEEDS_BASIS.has(action) && basis.length < BASIS_MIN_CHARS

/** The decision note: the basis line and the person's own note, whichever exist; null when neither does. */
export const decisionNote = (basisLine: string, note: OptionalNote): OptionalNote => {
    const joined = [basisLine, (note ?? "").trim()].filter((part) => part !== "").join(" · ")
    return joined === "" ? null : joined
}
