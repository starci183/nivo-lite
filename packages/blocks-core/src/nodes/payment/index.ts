import type { NodeDefinition } from "@nivo-lite/agent-sdk/node"
import { paymentClaimWaitNode } from "./claim-wait.node"
import { paymentEntryNode } from "./entry.node"
import { paymentEvidenceNode } from "./evidence.node"
import { paymentJudgeNode } from "./judge.node"
import { paymentMatchCodeNode } from "./match-code.node"
import { paymentSettleNode } from "./settle.node"

export { paymentClaimWaitNode, paymentEntryNode, paymentEvidenceNode, paymentJudgeNode, paymentMatchCodeNode, paymentSettleNode }

/** The nodes of the payment capability: tell a credit from a claim, gather the evidence of a bank transaction, the code rule, the AI judge, the settlement, the wait on a claim. */
export const paymentNodes: ReadonlyArray<NodeDefinition> = [
    paymentEntryNode,
    paymentEvidenceNode,
    paymentMatchCodeNode,
    paymentJudgeNode,
    paymentSettleNode,
    paymentClaimWaitNode,
]
