import { Test } from "@nestjs/testing"
import {
    CONFUSED_TOOL,
    DONE_TOOL,
    ONE_CALL_PER_TURN,
    ONE_CALL_REFUSAL,
    TOOL_CALL_REFUSAL,
    TOOL_CALL_REQUIRED,
    openingTextOf,
    stepBoundOf,
    wireToolsOf,
} from "./loop-frame.policy"
import { toolNamesOf } from "./tool-names.policy"

/** The members of the subject under test. */
interface Subject {
    readonly openingTextOf: typeof openingTextOf
    readonly stepBoundOf: typeof stepBoundOf
    readonly wireToolsOf: typeof wireToolsOf
}

const SUBJECT = Symbol("loop-frame.policy")

/** The policy functions, read through the Nest testing module. */
const build = async (): Promise<Subject> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { openingTextOf, stepBoundOf, wireToolsOf } }],
    }).compile()
    return moduleRef.get<Subject>(SUBJECT)
}

const TOOLS = [
    { name: "order.read", does: "Reads an order.", argsSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
    { name: "order.void", does: { key: "orderVoid" }, argsSchema: null },
]

describe("loop-frame.policy: the tool list of a request", () => {
    it("keeps the order and the schemas of the runner as they are, and closes with done and confused", async () => {
        const tools = (await build()).wireToolsOf(TOOLS, toolNamesOf([], false))

        expect(tools.map((tool) => tool.function.name)).toEqual(["order.read", "order.void", DONE_TOOL, CONFUSED_TOOL])
        expect(tools[0]?.function.parameters).toBe(TOOLS[0]?.argsSchema)
        expect(tools[1]?.function).toEqual({ name: "order.void", description: '{"key":"orderVoid"}', parameters: { type: "object", properties: {} } })
        expect(tools[2]?.function.parameters).toEqual({ type: "object", properties: { output: {} }, required: ["output"] })
        expect(tools[3]?.function.parameters).toEqual({
            type: "object",
            properties: { reason: { type: "string" }, question: { type: ["string", "null"] } },
            required: ["reason", "question"],
        })
    })

    it("is the same text every time it is made, and shows wire names when the run maps them", async () => {
        const policy = await build()
        const plain = toolNamesOf([], false)

        expect(JSON.stringify(policy.wireToolsOf(TOOLS, plain))).toBe(JSON.stringify(policy.wireToolsOf(TOOLS, plain)))
        expect(policy.wireToolsOf(TOOLS, toolNamesOf(["order.read", "order.void"], true)).map((tool) => tool.function.name)).toEqual([
            "order__read",
            "order__void",
            DONE_TOOL,
            CONFUSED_TOOL,
        ])
    })
})

describe("loop-frame.policy: the first user message", () => {
    it("opens with the step, then the volatile rules when the turn has them, then the input as JSON", async () => {
        const policy = await build()

        expect(policy.openingTextOf({ step: "STEP", volatile: " RULES ", input: { input: 1 } })).toBe('STEP\n\nRULES\n\n{"input":1}')
        expect(policy.openingTextOf({ step: "STEP", input: { input: 1 } })).toBe('STEP\n\n{"input":1}')
        expect(policy.openingTextOf({ step: "STEP", volatile: "  ", input: undefined })).toBe("STEP\n\nnull")
    })
})

describe("loop-frame.policy: the refusals the loop makes itself", () => {
    it("have the refusal shape of the runner: a code and bounded words", () => {
        expect(ONE_CALL_REFUSAL.ok).toBe(false)
        expect(ONE_CALL_REFUSAL.refused.code).toBe(ONE_CALL_PER_TURN)
        expect(TOOL_CALL_REFUSAL.ok).toBe(false)
        expect(TOOL_CALL_REFUSAL.refused.code).toBe(TOOL_CALL_REQUIRED)
        expect(Object.keys(ONE_CALL_REFUSAL.refused)).toEqual(["code", "message"])
        expect(Math.max(ONE_CALL_REFUSAL.refused.message.length, TOOL_CALL_REFUSAL.refused.message.length)).toBeLessThanOrEqual(200)
    })

    it("bounds the steps of the library well above what the turns of a step need", async () => {
        expect((await build()).stepBoundOf(12)).toBeGreaterThan(12 * 4)
    })
})
