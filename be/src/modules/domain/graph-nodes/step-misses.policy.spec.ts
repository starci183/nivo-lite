import { TOOL } from "@nivo-lite/agent-sdk/names"
import { missOfAnswer, withMiss, type StepMiss } from "./step-misses.policy"

// R68: what the engine reports of a step is read from the TYPED answers of its calls, in every form the template road hands them.
describe("step-misses.policy", () => {
    it("a customer send refused (the business refusal answer) is a miss with its code", () => {
        expect(missOfAnswer(TOOL.customerMessageSend, { ok: false, refusal: "outside_window", facts: {} })).toEqual({
            kind: "send_refused",
            tool: TOOL.customerMessageSend,
            refusal: "outside_window",
        })
        // The effect road's refused subject, as the send executor answers it.
        expect(missOfAnswer(TOOL.customerMessageSend, { kind: "refused", id: "customer_opted_out", facts: {} })).toMatchObject({
            refusal: "customer_opted_out",
        })
    })

    it("a receipt the send settled refused is the same miss; a delivered or uncertain receipt is none", () => {
        const receipt = (state: string, reason: string | null) => ({ ok: true, value: { sendKey: "k", state, reason }, via: { provider: null, connectionId: null } })
        expect(missOfAnswer(TOOL.customerMessageSend, receipt("refused", "not_delivered"))).toMatchObject({ refusal: "not_delivered" })
        expect(missOfAnswer(TOOL.customerMessageSend, receipt("delivered", null))).toBeNull()
        expect(missOfAnswer(TOOL.customerMessageSend, receipt("unknown", "delivery_outcome_unknown"))).toBeNull()
    })

    it("`route_held` is no miss (a person holds the route, R45), in either form", () => {
        expect(missOfAnswer(TOOL.customerMessageSend, { ok: false, refusal: "route_held", facts: {} })).toBeNull()
        expect(
            missOfAnswer(TOOL.customerMessageSend, { ok: true, value: { state: "refused", reason: "route_held" }, via: { provider: null, connectionId: null } }),
        ).toBeNull()
    })

    it("a declined approval is a miss of ANY tool; another tool's business refusal is none (the node reads it as data)", () => {
        expect(missOfAnswer(TOOL.teamMessagePost, { ok: false, refusal: "declined", facts: { tool: TOOL.teamMessagePost } })).toEqual({
            kind: "declined",
            tool: TOOL.teamMessagePost,
        })
        expect(missOfAnswer(TOOL.customerMessageSend, { ok: false, refusal: "declined", facts: {} })).toMatchObject({ kind: "declined" })
        expect(missOfAnswer(TOOL.contactGet, { ok: false, refusal: "not_found", facts: {} })).toBeNull()
        expect(missOfAnswer(TOOL.contactGet, { contactId: "c1" })).toBeNull()
    })

    it("the same miss answered twice (a replay, an agent's repeat) is kept once, in call order", () => {
        const misses: Array<StepMiss> = []
        withMiss(misses, missOfAnswer(TOOL.customerMessageSend, { ok: false, refusal: "outside_window", facts: {} }))
        withMiss(misses, missOfAnswer(TOOL.customerMessageSend, { ok: false, refusal: "outside_window", facts: {} }))
        withMiss(misses, null)
        withMiss(misses, missOfAnswer(TOOL.customerMessageSend, { ok: false, refusal: "declined", facts: {} }))
        expect(misses.map((one) => one.kind)).toEqual(["send_refused", "declined"])
    })
})
