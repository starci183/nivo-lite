import type { GraphDocument, GraphNode } from "../agent-graphs.contracts"

const behaviourOfNode = (node: GraphNode): unknown => ({
    key: node.key,
    step: node.step,
    next: node.next,
    action: node.action ?? null,
    pipeline: node.pipeline ?? null,
    approver: node.approver,
    decide:
        node.decide === undefined
            ? null
            : {
                  intent: node.decide.intent,
                  facts: node.decide.facts,
                  branches: node.decide.branches.map((branch) => ({
                      key: branch.key,
                      when: branch.when,
                      outcome: branch.outcome,
                      next: branch.next,
                      approver: branch.approver,
                  })),
              },
})

/**
 * True when two graphs do the same thing: the same nodes, conditions, outcomes and approvers. The words are left out, so a seed
 * written in another language is not a change of what the agent does.
 */
export const sameBehaviour = (left: GraphDocument, right: GraphDocument): boolean =>
    JSON.stringify(left.nodes.map(behaviourOfNode)) === JSON.stringify(right.nodes.map(behaviourOfNode))

/** True when two graphs grant the same data rights, kind by kind. */
export const sameRights = (left: GraphDocument, right: GraphDocument): boolean =>
    JSON.stringify([...left.rights].sort((a, b) => a.kind.localeCompare(b.kind))) ===
    JSON.stringify([...right.rights].sort((a, b) => a.kind.localeCompare(b.kind)))
