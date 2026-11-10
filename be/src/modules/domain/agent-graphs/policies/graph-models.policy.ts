import { graphModelProblems } from "@nivo-lite/blocks-core"
import type { GraphModelProblem } from "@nivo-lite/blocks-core"
import { isRecord } from "@modules/platform/primitives"
import { AgentGraphsError, AgentGraphsErrorCode } from "../errors/agent-graphs.error"

/** One node of a saved document's flow, read loosely: only its key, step and model matter here. */
interface FlowNodeModel {
    readonly key: string
    readonly kind: "trigger" | "condition" | "execute" | "output"
    readonly step: string
    readonly model?: string
}

/** The nodes of the document's flow that name a model, read loosely; the flow's own schema is checked where it always was. */
const namedOf = (document: unknown): ReadonlyArray<FlowNodeModel> => {
    const flow = isRecord(document) ? document.flow : undefined
    const nodes: unknown = isRecord(flow) ? flow.nodes : undefined
    if (!Array.isArray(nodes)) return []
    return nodes.flatMap((node: unknown): ReadonlyArray<FlowNodeModel> =>
        isRecord(node) && typeof node.key === "string" && typeof node.step === "string" && node.model !== undefined
            ? [{ key: node.key, kind: "execute", step: node.step, model: typeof node.model === "string" ? node.model : "" }]
            : [],
    )
}

/**
 * Refuses a draft whose flow names a model the vocabulary does not know (`auto` and the selectable ids pass), or names one on a node
 * that calls no AI: every problem in `problems` as JSON (code, node key) for the editor, the first node key in `first`.
 */
export const requireKnownModels = (document: unknown): void => {
    const problems: ReadonlyArray<GraphModelProblem> = graphModelProblems({ nodes: namedOf(document) })
    const [first] = problems
    if (first === undefined) return
    throw new AgentGraphsError({
        code: AgentGraphsErrorCode.ModelRefused,
        params: { count: String(problems.length), first: first.nodeKey, problems: JSON.stringify(problems) },
    })
}
