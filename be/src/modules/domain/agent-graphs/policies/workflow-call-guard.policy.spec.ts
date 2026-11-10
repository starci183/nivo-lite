import { Test } from "@nestjs/testing"
import { mock } from "@starci/jest-preset"
import * as policy from "./workflow-call-guard.policy"
import type { CallLink } from "./workflow-call-guard.policy"

const SUBJECT = Symbol("workflow-call-guard.policy")

/** The policy, bound as a kit double over its real functions. */
const subject = mock<typeof policy>({ ...policy })

/** The policy as Nest hands it to a caller. */
const buildPolicy = async (): Promise<typeof policy> => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: subject }],
    }).compile()
    return moduleRef.get<typeof policy>(SUBJECT)
}

const link = (over: Partial<CallLink> = {}): CallLink => ({
    agentId: "sales",
    workflow: "wf-after-sale",
    leadId: "lead-1",
    paramHash: "h-1",
    ...over,
})

describe("workflow-call-guard.policy", () => {
    it("reads the call a hand-off wrote, and nothing for a wake no call made", async () => {
        const { callOf } = await buildPolicy()
        expect(callOf({ caller: { runId: "run-1" }, params: { leadId: "lead-1" } })).toEqual({
            callerRunId: "run-1",
            params: { leadId: "lead-1" },
        })
        expect(callOf({ caller: { runId: "run-1" } })).toEqual({ callerRunId: "run-1", params: {} })
        expect(callOf({ caller: { runId: "" } })).toBeNull()
        expect(callOf({ params: {} })).toBeNull()
        expect(callOf(null)).toBeNull()
    })

    it("hashes the same params the same whatever their member order, and other params otherwise", async () => {
        const { paramHashOf } = await buildPolicy()
        const one = paramHashOf({ leadId: "l", order: { no: 1, items: [{ a: 1, b: 2 }] } })
        expect(paramHashOf({ order: { items: [{ b: 2, a: 1 }], no: 1 }, leadId: "l" })).toBe(one)
        expect(paramHashOf({ leadId: "l", order: { no: 2, items: [] } })).not.toBe(one)
    })

    it("reads the lead of a call from the trigger, else from its params", async () => {
        const { callLeadOf } = await buildPolicy()
        const call = { callerRunId: "r", params: { leadId: "lead-p" } }
        expect(callLeadOf({ leadId: "lead-t" }, call)).toBe("lead-t")
        expect(callLeadOf({}, call)).toBe("lead-p")
        expect(callLeadOf({}, { callerRunId: "r", params: {} })).toBeNull()
    })

    it("refuses a cycle on the same lead and params, and a chain past the depth limit", async () => {
        const { CALL_DEPTH_MAX, chainRefusalOf, duplicates } = await buildPolicy()
        const chain = [link({ workflow: "wf-consult" }), link()]
        expect(chainRefusalOf(link(), chain)).toBe("call_cycle")
        expect(chainRefusalOf(link({ paramHash: "h-2" }), chain)).toBeNull()
        expect(chainRefusalOf(link({ leadId: "lead-2" }), chain)).toBeNull()
        const deep = Array.from({ length: CALL_DEPTH_MAX - 1 }, (_, at) => link({ workflow: `wf-${at}` }))
        expect(chainRefusalOf(link(), deep)).toBeNull()
        expect(chainRefusalOf(link(), [...deep, link({ workflow: "wf-x" })])).toBe("call_too_deep")
        expect(duplicates(link(), link())).toBe(true)
        expect(duplicates(link(), link({ agentId: "other" }))).toBe(false)
    })
})
