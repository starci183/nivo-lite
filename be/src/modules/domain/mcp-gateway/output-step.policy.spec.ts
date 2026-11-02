import { Test } from "@nestjs/testing"
import { outputStepOf } from "./output-step.policy"

const POLICY = Symbol("output-step.policy.ts")
type PolicyFunctions = Pick<typeof import("./output-step.policy"), "outputStepOf">
const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: POLICY, useValue: { outputStepOf } }],
    }).compile()
    return moduleRef.get<PolicyFunctions>(POLICY)
}

describe("outputStepOf", () => {
    it("keeps an empty summary when a successful call supplied none", async () => {
        const subject = await build()
        expect(subject.outputStepOf("a.b", { ok: true, value: { id: 1 } })).toEqual({
            tool: "a.b",
            status: "ok",
            code: null,
            summary: "",
        })
    })

    it("keeps the masked summary of a call that ran, never its raw answer", async () => {
        const subject = await build()

        expect(subject.outputStepOf("a.b", { ok: true, value: { id: 1 }, summary: '{"id":1}' })).toEqual({
            tool: "a.b",
            status: "ok",
            code: null,
            summary: '{"id":1}',
        })
    })

    it("keeps why a call failed", async () => {
        const subject = await build()

        expect(subject.outputStepOf("a.b", { ok: false, code: "tool_error", detail: "full" })).toEqual({
            tool: "a.b",
            status: "failed",
            code: "tool_error",
            summary: "full",
        })
    })

    it("holds a call a person has to approve", async () => {
        const subject = await build()

        expect(subject.outputStepOf("a.b", { ok: false, code: "approval_required", reason: "ask_mode" })).toEqual({
            tool: "a.b",
            status: "held",
            code: "ask_mode",
            summary: "",
        })
    })
})
