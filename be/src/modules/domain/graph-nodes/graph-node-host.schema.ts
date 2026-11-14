import type { output, ZodType } from "zod"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"

/** A schema the node host's core door parses a guided model answer with. */
export type NodeAnswerSchema<T> = ZodType<T>

/** The most issues of an answer that does not fit, named in the failure's params. */
const ISSUES_NAMED_MAX = 8

/**
 * The model's answer as the schema reads it, or the TYPED AI failure `GRAPH_NODES_MODEL_ANSWER_INVALID` (its issues as `path: message`
 * text) when it does not fit: a model call's answer never leaves a step as a raw parse error (`handler_threw`, P-FIX2 / DEF-2); the step
 * stops as "the AI failed" (`isAiFailure`).
 */
export const fittedAnswerOf = <S extends ZodType>(schema: S, answer: unknown): output<S> => {
    const checked = schema.safeParse(answer)
    if (checked.success) return checked.data
    const issues = checked.error.issues
        .slice(0, ISSUES_NAMED_MAX)
        .map((issue) => `${issue.path.length === 0 ? "(root)" : issue.path.map(String).join(".")}: ${issue.message}`)
        .join("; ")
    throw new GraphNodesError({ code: GraphNodesErrorCode.ModelAnswerInvalid, params: { issues } })
}
