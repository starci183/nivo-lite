import type { BranchApproval } from "@modules/domain/approval-requests"
import type { BranchApprover, GraphDocument } from "../agent-graphs.contracts"

/** The approver the branch of a decision named in its graph, or null when the graph no longer names one. */
export const branchApproverOf = (document: GraphDocument, action: string, branchKey: string): BranchApprover | null => {
    const node = document.nodes.find((entry) => entry.decide?.intent === action)
    return node?.decide?.branches.find((branch) => branch.key === branchKey)?.approver ?? null
}

/** What the approval requests ask of a branch's approver: the group, the policy and the wait. */
export const branchApprovalOf = (approver: BranchApprover): BranchApproval => ({
    group: approver.group,
    policy: approver.policy,
    timeoutMinutes: approver.timeoutMinutes,
})
