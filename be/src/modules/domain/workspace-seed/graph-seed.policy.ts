import { graphSpecSchema } from "@nivo-lite/agent-sdk/graph"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { WorkspaceSeedError, WorkspaceSeedErrorCode } from "./errors/workspace-seed.error"

const invalid = (): never => {
    throw new WorkspaceSeedError({ code: WorkspaceSeedErrorCode.InputInvalid })
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    value !== null && typeof value === "object" && !Array.isArray(value)

const documentOf = (entry: unknown): unknown => (isRecord(entry) && "document" in entry ? entry.document : invalid())

/**
 * The graph specs of the envelope the stack seed step writes on stdin (one line of JSON, a document for each file of the folder). A
 * document that is not a graph spec, or a module with two graphs, is refused; nothing of a document is named in the refusal.
 */
export const readGraphSpecs = (text: string): ReadonlyArray<GraphSpec> => {
    let envelope: unknown
    try {
        envelope = JSON.parse(text)
    } catch {
        return invalid()
    }
    if (!isRecord(envelope) || !Array.isArray(envelope.documents)) return invalid()
    const specs = envelope.documents.map((entry: unknown) => {
        const parsed = graphSpecSchema.safeParse(documentOf(entry))
        return parsed.success ? parsed.data : invalid()
    })
    const keys = specs.map((spec) => spec.moduleKey)
    return new Set(keys).size === keys.length ? specs : invalid()
}
