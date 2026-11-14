import { Test } from "@nestjs/testing"
import type { ToolCallResult } from "@modules/domain/tool-receipts"
import type { DoorFailure } from "@nivo-lite/agent-sdk/mutation"
import * as policy from "./door-call.policy"

/** The code of a gateway answer that is not a value or a wait for approval. */
type FailureCode = Exclude<Extract<ToolCallResult, { ok: false }>["code"], "approval_required">

/** The policy functions as one provider, read through the Nest testing module. */
class PolicySubject {
    readonly doorResultOf = policy.doorResultOf
    readonly gatewayNameOf = policy.gatewayNameOf
    readonly opKeyOf = policy.opKeyOf
}

const build = async (): Promise<PolicySubject> => {
    const moduleRef = await Test.createTestingModule({ providers: [PolicySubject] }).compile()
    return moduleRef.get(PolicySubject)
}

describe("gatewayNameOf", () => {
    it("drops the group of a door tool and keeps the connector and its tool", async () => {
        const p = await build()
        expect(p.gatewayNameOf("chat.zalo.send")).toBe("zalo.send")
        expect(p.gatewayNameOf("accounting.books.write")).toBe("books.write")
    })
})

describe("doorResultOf", () => {
    it("carries the output of an ok call", async () => {
        const p = await build()
        expect(p.doorResultOf({ ok: true, value: { id: "a", list: [1, null, "x"], on: true } })).toEqual({
            ok: true,
            output: { id: "a", list: [1, null, "x"], on: true },
        })
    })

    it("fails an ok call whose output is not JSON, or nests past the bound", async () => {
        const p = await build()
        expect(p.doorResultOf({ ok: true, value: { run: () => 1 } })).toMatchObject({ ok: false, reason: "failed" })
        let deep: Record<string, unknown> = {}
        for (let i = 0; i < 40; i += 1) deep = { deep }
        expect(p.doorResultOf({ ok: true, value: deep })).toMatchObject({ ok: false, reason: "failed" })
    })

    it.each<[FailureCode, DoorFailure]>([
        ["unknown_tool", "unknown_tool"],
        ["invalid_arguments", "invalid"],
        ["invalid_name", "invalid"],
        ["idempotency_key_required", "invalid"],
        ["not_granted", "forbidden"],
        ["internal_only", "forbidden"],
        ["unavailable", "transient"],
        ["unknown_outcome", "transient"],
        ["tool_error", "failed"],
    ])("maps the gateway failure %s to %s and keeps its detail", async (code, reason) => {
        const p = await build()
        const result: ToolCallResult = { ok: false, code, detail: "why" }
        expect(p.doorResultOf(result)).toEqual({ ok: false, reason, message: "why" })
    })

    it("answers a call that waits for a person as forbidden, naming the reason", async () => {
        const p = await build()
        expect(p.doorResultOf({ ok: false, code: "approval_required", reason: "ask_mode" })).toEqual({
            ok: false,
            reason: "forbidden",
            message: "approval_required:ask_mode",
        })
    })
})

describe("opKeyOf", () => {
    it("joins the effect key of the tool to the hash of the arguments", async () => {
        const p = await build()
        expect(p.opKeyOf((step) => `job-1:${step}`, "chat.zalo.send", "abc")).toBe("job-1:chat.zalo.send:abc")
    })
})
