import type { BranchApproval } from "@modules/domain/approval-requests"
import type { BranchApprover, GraphDocument } from "../agent-graphs.contracts"

/** The approver of a decision in its graph: the one its branch named, else the one of the approval node its path went through; null when neither names one. */
export const branchApproverOf = (
    document: GraphDocument,
    action: string,
    branchKey: string,
    path: ReadonlyArray<string> = [],
): BranchApprover | null => {
    const node = document.nodes.find((entry) => entry.decide?.intent === action)
    const named = node?.decide?.branches.find((branch) => branch.key === branchKey)?.approver
    const walked = document.nodes.find((entry) => entry.step === "approval" && path.includes(entry.key))
    return named ?? walked?.approver ?? null
}

/** What the approval requests ask of a branch's approver: the group, the policy and the wait. */
export const branchApprovalOf = (approver: BranchApprover): BranchApproval => ({
    group: approver.group,
    policy: approver.policy,
    timeoutMinutes: approver.timeoutMinutes,
})
