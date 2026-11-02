import { GATEWAY_CALL_ACTION } from "@modules/domain/authority-rules"
import type { OutputNodes } from "@modules/domain/authority-rules"
import type { GraphDocument, GraphNode } from "../agent-graphs.contracts"

/** The action a customer reply is. */
const REPLY_ACTION = "reply_customer"

/** The nodes of a graph that draws none. */
export const NO_OUTPUT_NODES: OutputNodes = { output: "", approval: "", reply: "" }

const isReply = (node: GraphNode): boolean => node.action === REPLY_ACTION || node.step === "reply"

/** The output node of a tool call, the approval that leads to it, and the node of the customer reply, as this version draws them. */
export const outputNodesOf = (document: GraphDocument): OutputNodes => {
    const output = document.nodes.find((node) => node.step === "write" && node.action === GATEWAY_CALL_ACTION)
    const key = output?.key ?? ""
    const approval = document.nodes.find((node) => node.step === "approval" && node.next.includes(key))
    return { output: key, approval: approval?.key ?? "", reply: document.nodes.find(isReply)?.key ?? "" }
}
