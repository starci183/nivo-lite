import type { AgentStepUsage } from "@modules/domain/ai-usage-events"
import { declaredModelOf } from "@modules/domain/graph-nodes"
import { INSTALLED } from "@modules/domain/installed-plugins"
import { isRecord, parseJsonText } from "@modules/platform/primitives"
import type { AgentGraphAiNode } from "./agent-graph-read.contracts"

/** A graph node as the stored draft holds it: only what this read needs. */
interface DraftNode {
    readonly key: string
    readonly step: string
    readonly model?: string | undefined
}

/** The nodes of a stored draft (`draftJson`), the ones of another shape left out. */
const draftNodesOf = (draftJson: string): ReadonlyArray<DraftNode> => {
    const parsed = parseJsonText(draftJson)
    if (!parsed.ok || !isRecord(parsed.value)) return []
    const nodes: unknown = parsed.value["nodes"]
    if (!Array.isArray(nodes)) return []
    return nodes.flatMap((node: unknown): ReadonlyArray<DraftNode> => {
        if (!isRecord(node)) return []
        const { key, step, model } = node
        if (typeof key !== "string" || typeof step !== "string") return []
        return [{ key, step, ...(typeof model === "string" && model !== "" ? { model } : {}) }]
    })
}

/**
 * The AI nodes of an agent's graph with their declared model and their model use over the window: a node is an AI node when
 * blocks-core declares a model for its step, when the shop named one on it, or when the window booked calls to it. Its declared model
 * is resolved as the engine resolves it (`declaredModelOf`: the node's own, else blocks-core's, else the default). Credits are exact
 * fractions; a node with no run in the window shows zeros.
 */
export const graphAiNodesOf = (
    draftJson: string,
    usage: ReadonlyArray<AgentStepUsage>,
): ReadonlyArray<AgentGraphAiNode> => {
    const used = new Map(usage.map((step) => [step.stepKey, step]))
    return draftNodesOf(draftJson)
        .filter((node) => INSTALLED.nodeModelOf(node.step) !== null || node.model !== undefined || used.has(node.key))
        .map((node) => {
            const declared = declaredModelOf(node.step, node.model)
            const step = used.get(node.key)
            return {
                nodeKey: node.key,
                nodeId: node.step,
                declaredModel: declared.model,
                modelSource: declared.source,
                weight: declared.weight,
                runs: step?.runs ?? 0,
                calls: step?.calls ?? 0,
                failedTries: step?.failedTries ?? 0,
                costUsd: step?.costUsd ?? 0,
                credits: step?.credits ?? 0,
                creditsPerRun: step?.creditsPerRun ?? 0,
                failedCostUsd: step?.failedCostUsd ?? 0,
                averageMs: step?.averageMs ?? null,
                servedModels: step?.models ?? [],
            }
        })
}
