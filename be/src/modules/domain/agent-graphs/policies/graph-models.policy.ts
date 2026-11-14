import { isModelChoice, isRetiredModel } from "@nivo-lite/agent-sdk/models"
import { INSTALLED } from "@modules/domain/installed-plugins"
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

/** One problem of the models a graph names. */
interface GraphModelProblem {
    /**
     * `MODEL_RETIRED`: a retired model (DeepSeek flash): a stored graph still runs with it, a save refuses it; `MODEL_UNKNOWN`: not
     * Auto and not a model of the vocabulary; `MODEL_ON_NODE_WITHOUT_AI`: the node's step calls no AI.
     */
    readonly code: "MODEL_RETIRED" | "MODEL_UNKNOWN" | "MODEL_ON_NODE_WITHOUT_AI"
    /** The node's key. */
    readonly nodeKey: string
}

/**
 * The problems of the models a draft names, in node order (blocks-core's old `graphModelProblems`, moved here): whether a step calls
 * AI is what the installed plugins declare for it (`INSTALLED.nodeModelOf`: a template node's own model, else its plugin's table), so a
 * node of any plugin that calls AI may name a model like a core node may.
 */
const problemsOf = (named: ReadonlyArray<FlowNodeModel>): ReadonlyArray<GraphModelProblem> =>
    named.flatMap((node): ReadonlyArray<GraphModelProblem> => {
        if (node.model === undefined) return []
        if (isRetiredModel(node.model)) return [{ code: "MODEL_RETIRED", nodeKey: node.key }]
        if (!isModelChoice(node.model)) return [{ code: "MODEL_UNKNOWN", nodeKey: node.key }]
        return INSTALLED.nodeModelOf(node.step) === null ? [{ code: "MODEL_ON_NODE_WITHOUT_AI", nodeKey: node.key }] : []
    })

/**
 * Refuses a draft whose flow names a model the vocabulary does not know (`auto` and the selectable ids pass), or names one on a node
 * that calls no AI: every problem in `problems` as JSON (code, node key) for the editor, the first node key in `first`.
 */
export const requireKnownModels = (document: unknown): void => {
    const problems = problemsOf(namedOf(document))
    const [first] = problems
    if (first === undefined) return
    throw new AgentGraphsError({
        code: AgentGraphsErrorCode.ModelRefused,
        params: { count: String(problems.length), first: first.nodeKey, problems: JSON.stringify(problems) },
    })
}
