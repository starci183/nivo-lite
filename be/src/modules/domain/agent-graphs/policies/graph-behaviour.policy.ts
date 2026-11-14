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
                      mode: branch.mode,
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
    JSON.stringify(left.nodes.map((item) => behaviourOfNode(item))) ===
    JSON.stringify(right.nodes.map((item) => behaviourOfNode(item)))
