import type { AgentGraphBranchForm } from "@/modules/types"
import type {
    AgentGraphWireApprover,
    AgentGraphWireBranch,
    AgentGraphWireDocument,
    AgentGraphWireNode,
} from "./agent-graph-wire"

/** Which branch of which condition node a change is about. */
export interface AgentGraphBranchRef {
    readonly nodeKey: string
    readonly branchKey: string
}

const groupOf = (memberId: string) => ({ roles: [], rooms: [], members: memberId === "" ? [] : [memberId] })

/** The condition a form writes: an amount from and up to, with an open end where the bound is 0. */
const conditionOf = (fact: string, form: AgentGraphBranchForm, before: unknown): unknown => {
    const hasFrom = form.fromVnd > 0
    const hasTo = form.toVnd > 0
    if (hasFrom && hasTo)
        return {
            all: [
                { fact, op: "gte", value: form.fromVnd },
                { fact, op: "lt", value: form.toVnd },
            ],
        }
    if (hasTo) return { fact, op: "lt", value: form.toVnd }
    return hasFrom ? { fact, op: "gte", value: form.fromVnd } : before
}

/** The approver a form names, keeping the policy the branch had. */
const approverOf = (
    form: AgentGraphBranchForm,
    before: AgentGraphWireApprover | null,
): AgentGraphWireApprover | null => {
    if (form.then !== "ask" || form.approverId === "") return null
    const onTimeout =
        form.onTimeout === "backup"
            ? { kind: "backup" as const, group: groupOf(form.backupId) }
            : { kind: form.onTimeout }
    return {
        group: groupOf(form.approverId),
        policy: before?.policy ?? "any",
        timeoutMinutes: form.timeoutHours * 60,
        onTimeout,
    }
}

/** The branch with the form applied; the condition of the closing "else" branch stays. */
const branchWithForm = (
    branch: AgentGraphWireBranch,
    fact: string,
    form: AgentGraphBranchForm,
): AgentGraphWireBranch => {
    const when = branch.when === "else" ? branch.when : conditionOf(fact, form, branch.when)
    return { ...branch, when, then: form.then, approver: approverOf(form, branch.approver), selfCorrected: true }
}

const withBranch = (
    node: AgentGraphWireNode,
    ref: AgentGraphBranchRef,
    form: AgentGraphBranchForm,
): AgentGraphWireNode => {
    const decide = node.decide
    if (decide === undefined) return node
    const fact = decide.facts[0] ?? ""
    const branches = decide.branches.map((branch) =>
        branch.key === ref.branchKey ? branchWithForm(branch, fact, form) : branch,
    )
    return { ...node, decide: { ...decide, branches } }
}

/** The document after the owner saved one branch: the condition, the action and the approver of the branch, and the approver of the node it goes to. */
export const documentWithBranch = (
    document: AgentGraphWireDocument,
    ref: AgentGraphBranchRef,
    form: AgentGraphBranchForm,
): AgentGraphWireDocument => {
    const target = document.nodes
        .find((node) => node.key === ref.nodeKey)
        ?.decide?.branches.find((branch) => branch.key === ref.branchKey)
    return {
        ...document,
        nodes: document.nodes.map((node) => {
            if (node.key === ref.nodeKey) return withBranch(node, ref, form)
            return node.key === target?.next ? { ...node, approver: approverOf(form, node.approver) } : node
        }),
    }
}
