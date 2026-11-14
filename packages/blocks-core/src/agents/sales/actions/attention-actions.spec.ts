import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import type { PortProvider } from "@nivo-lite/agent-sdk/port"
import { LEAD_NEW, sampleState } from "../fixtures/sales.data"
import { salesContextOf } from "../fixtures/sales.context"
import { memoryProvider } from "../memory"
import type { MemoryState } from "../memory"
import { salesLeads } from "../ports"
import { followAction } from "./follow.action"
import { replyAction } from "./reply.action"
import { respondAction } from "./respond.action"

const CONTEXT = salesContextOf()

const run = (action: ActionDefinition, raw: unknown, provider: PortProvider): Promise<ActionResult> =>
    action.execute?.(provider, raw, CONTEXT) ?? Promise.resolve({ ok: false, reason: "failed", message: { key: "x" } })

/** A provider whose lead port answers every update with the given failure. */
const failingLeads = (state: MemoryState, failure: Record<string, unknown>): PortProvider => {
    const provider = memoryProvider(state)
    return {
        implementationOf: (port) => {
            const implementation = provider.implementationOf(port)
            if (port.id !== salesLeads.id || typeof implementation !== "object" || implementation === null)
                return implementation
            return { ...implementation, update: () => Promise.resolve(failure) }
        },
    }
}

const leadOf = (state: MemoryState, id: string): (typeof state.leads)[number] | undefined =>
    state.leads.find((lead) => lead.id === id)

describe("sales.respond", () => {
    it("stops the customer waiting for an answer", async () => {
        const state = sampleState([])
        expect(await run(respondAction, { id: LEAD_NEW.id }, memoryProvider(state))).toEqual({ ok: true })
        expect(leadOf(state, LEAD_NEW.id)?.awaitingSince).toBeNull()
    })

    it("refuses a customer who does not wait, and one that is gone, as data", async () => {
        const state = sampleState([])
        expect(await run(respondAction, { id: "lead-4" }, memoryProvider(state))).toMatchObject({
            ok: false,
            reason: "refused",
            message: { key: "refusal_not_awaiting" },
        })
        expect(await run(respondAction, { id: "nobody" }, memoryProvider(state))).toMatchObject({
            message: { key: "refusal_missing" },
        })
    })

    it("answers a conflict when the customer changed since it was read", async () => {
        const state = sampleState([])
        const stale = failingLeads(state, { ok: false, reason: "stale" })
        expect(await run(respondAction, { id: LEAD_NEW.id }, stale)).toMatchObject({ ok: false, reason: "conflict" })
    })
})

describe("sales.follow", () => {
    it("makes the next step due again after two days by default", async () => {
        const state = sampleState([])
        expect(await run(followAction, { id: "lead-3" }, memoryProvider(state))).toEqual({ ok: true })
        expect(leadOf(state, "lead-3")?.nextDueAt).toBe("2026-11-07T09:00:00.000Z")
    })

    it("makes it due after the named number of days", async () => {
        const state = sampleState([])
        await run(followAction, { id: "lead-3", days: 7 }, memoryProvider(state))
        expect(leadOf(state, "lead-3")?.nextDueAt).toBe("2026-11-12T09:00:00.000Z")
    })

    it("refuses a closed deal and a customer that is gone as data", async () => {
        const state = sampleState([])
        expect(await run(followAction, { id: "lead-5" }, memoryProvider(state))).toMatchObject({
            message: { key: "refusal_stage_not_allowed" },
        })
        expect(await run(followAction, { id: "nobody" }, memoryProvider(state))).toMatchObject({
            message: { key: "refusal_missing" },
        })
    })

    it("refuses a day count past the bound", async () => {
        const result = await run(followAction, { id: "lead-3", days: 31 }, memoryProvider(sampleState([])))
        expect(result).toMatchObject({ ok: false, reason: "invalid" })
    })

    it("answers a conflict when the deal changed since it was read", async () => {
        const stale = failingLeads(sampleState([]), { ok: false, reason: "stale" })
        expect(await run(followAction, { id: "lead-3" }, stale)).toMatchObject({ ok: false, reason: "conflict" })
    })
})

describe("sales.reply", () => {
    it("saves the phone the owner gave in its normal form and clears the question", async () => {
        const state = sampleState([])
        expect(await run(replyAction, { id: "lead-2", phone: "0912 000 702" }, memoryProvider(state))).toEqual({
            ok: true,
        })
        expect(leadOf(state, "lead-2")).toMatchObject({ phone: "84912000702", needs: null })
    })

    it("refuses an answer that is no phone, and a customer that is gone, as data", async () => {
        const state = sampleState([])
        expect(await run(replyAction, { id: "lead-2", phone: "call me" }, memoryProvider(state))).toMatchObject({
            message: { key: "refusal_phone_required" },
        })
        expect(await run(replyAction, { id: "lead-2" }, memoryProvider(state))).toMatchObject({
            message: { key: "refusal_phone_required" },
        })
        expect(await run(replyAction, { id: "nobody", phone: "0912000702" }, memoryProvider(state))).toMatchObject({
            message: { key: "refusal_missing" },
        })
    })

    it("refuses a phone that belongs to another customer, a vanished write and a stale one as data", async () => {
        const state = sampleState([])
        const taken = failingLeads(state, { ok: false, reason: "taken", constraint: "phone_key", refusal: "x" })
        expect(await run(replyAction, { id: "lead-2", phone: "0912000702" }, taken)).toMatchObject({
            message: { key: "refusal_phone_taken" },
        })
        const gone = failingLeads(state, { ok: false, reason: "missing" })
        expect(await run(replyAction, { id: "lead-2", phone: "0912000702" }, gone)).toMatchObject({
            message: { key: "refusal_missing" },
        })
        const stale = failingLeads(state, { ok: false, reason: "stale" })
        expect(await run(replyAction, { id: "lead-2", phone: "0912000702" }, stale)).toMatchObject({
            reason: "conflict",
        })
    })
})
