import { z } from "zod"
import { GraphNodesError, GraphNodesErrorCode } from "./errors/graph-nodes.error"
import { fittedAnswerOf } from "./graph-node-host.schema"
import { isAiFailure, troubleOfThrow } from "../agent-graphs/policies/step-trouble.policy"

// P-FIX2 / DEF-2 (dev runs 22c340e1 and 8b9bcff6): the node's model port did `schema.parse(answer)` and the ZodError `invalid_union`
// left the step as `handler_threw` (a crash). An answer that does not fit is the AI's typed failure: the step stops as "the AI failed".
const TURN = z.union([z.object({ call: z.object({ tool: z.string() }) }), z.object({ done: z.object({ branch: z.string() }) })])

describe("fittedAnswerOf: a model answer that does not fit the node's schema is a typed AI failure", () => {
    it("answers the parsed value when it fits", () => {
        expect(fittedAnswerOf(TURN, { done: { branch: "off" } })).toEqual({ done: { branch: "off" } })
    })

    it("throws GRAPH_NODES_MODEL_ANSWER_INVALID with the issues, which the step trouble policy reads as the AI's failure (not handler_threw)", () => {
        let thrown: unknown = null
        try {
            fittedAnswerOf(TURN, { branch: "off", reply: null })
        } catch (cause) {
            thrown = cause
        }
        expect(thrown).toBeInstanceOf(GraphNodesError)
        expect(thrown).toMatchObject({ code: GraphNodesErrorCode.ModelAnswerInvalid, params: { issues: expect.stringContaining("(root)") } })
        const trouble = troubleOfThrow(thrown)
        expect(trouble.code).toBe("GRAPH_NODES_MODEL_ANSWER_INVALID")
        expect(isAiFailure(trouble)).toBe(true)
    })
})
