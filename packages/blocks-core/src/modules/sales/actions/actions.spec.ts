import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import type { PortProvider, RunContext } from "@nivo-lite/agent-sdk/port"
import { LEAD_NEW, ORDER_WAITING, sampleState, SAMPLE_NOW } from "../fixtures/sales.data"
import { memoryProvider } from "../memory"
import type { MemoryState } from "../memory"
import { cancelOrderAction } from "./cancel-order.action"
import { confirmOrderAction } from "./confirm-order.action"
import { moveStageAction } from "./move-stage.action"

const OWNER = "owner-1"
const STAFF = "staff-1"

const contextOf = (memberId: string | null): RunContext => ({ workspaceId: "w1", memberId, now: new Date(SAMPLE_NOW) })

const execute = (
    action: ActionDefinition,
    provider: PortProvider,
    raw: unknown,
    memberId: string | null,
): Promise<ActionResult> => {
    return (
        action.execute?.(provider, raw, contextOf(memberId)) ??
        Promise.resolve({ ok: false, reason: "failed", message: { key: "not_run" } })
    )
}

const run = (
    action: ActionDefinition,
    raw: unknown,
    state: MemoryState,
    memberId: string | null = STAFF,
): Promise<ActionResult> => execute(action, memoryProvider(state), raw, memberId)

/** A provider whose store under `portId` answers every update with the given failure. */
const failingUpdate = (state: MemoryState, portId: string, reason: "conflict" | "missing"): PortProvider => {
    const provider = memoryProvider(state)
    return {
        implementationOf: (port) => {
            const implementation = provider.implementationOf(port)
            if (port.id !== portId || typeof implementation !== "object" || implementation === null)
                return implementation
            return { ...implementation, update: () => Promise.resolve({ ok: false, reason }) }
        },
    }
}

const stageOf = (state: MemoryState, id: string): string | undefined =>
    state.leads.find((lead) => lead.id === id)?.stage
const statusOf = (state: MemoryState, id: string): string | undefined =>
    state.orders.find((order) => order.id === id)?.status

describe("sales.move-stage", () => {
    it("moves a deal between open stages and clears any reason", async () => {
        const state = sampleState([])
        expect(await run(moveStageAction, { id: "lead-1", to: "qualified" }, state)).toEqual({
            ok: true,
            data: { stage: "qualified" },
        })
        expect(state.leads.find((lead) => lead.id === "lead-1")).toMatchObject({
            stage: "qualified",
            closedReason: null,
            version: "2",
        })
    })

    it("closes a deal with a reason, which the lead keeps", async () => {
        const state = sampleState([])
        const result = await run(moveStageAction, { id: "lead-4", to: "lost", reason: "  chose a rival  " }, state)
        expect(result).toEqual({ ok: true, data: { stage: "lost" } })
        expect(state.leads.find((lead) => lead.id === "lead-4")).toMatchObject({
            stage: "lost",
            closedReason: "chose a rival",
        })
    })

    it("refuses as data a move without a reason, to the same stage, or the flow does not allow", async () => {
        const state = sampleState([])
        expect(await run(moveStageAction, { id: "lead-4", to: "won", reason: null }, state)).toMatchObject({
            ok: false,
            reason: "refused",
            message: { key: "refusal_reason_required" },
        })
        expect(await run(moveStageAction, { id: "lead-1", to: "new" }, state)).toMatchObject({
            message: { key: "refusal_same_stage" },
        })
        expect(await run(moveStageAction, { id: "lead-5", to: "new" }, state)).toMatchObject({
            message: { key: "refusal_stage_not_allowed" },
        })
        expect(stageOf(state, "lead-4")).toBe("proposal")
    })

    it("refuses a lead that does not exist", async () => {
        expect(await run(moveStageAction, { id: "lead-404", to: "qualified" }, sampleState([]))).toMatchObject({
            ok: false,
            message: { key: "refusal_missing" },
        })
    })

    it("answers a lead another writer got to first as a conflict, and one that vanished as missing", async () => {
        const state = sampleState([])
        const input = { id: "lead-1", to: "qualified" }
        expect(
            await execute(moveStageAction, failingUpdate(state, "sales.lead-store", "conflict"), input, STAFF),
        ).toMatchObject({ ok: false, reason: "conflict" })
        expect(
            await execute(moveStageAction, failingUpdate(state, "sales.lead-store", "missing"), input, STAFF),
        ).toMatchObject({ ok: false, reason: "refused", message: { key: "refusal_missing" } })
    })

    it("refuses an input with a stage that is no stage or a key it does not declare", async () => {
        const state = sampleState([])
        expect(await run(moveStageAction, { id: "lead-1", to: "contacted" }, state)).toMatchObject({
            ok: false,
            reason: "invalid",
        })
        expect(await run(moveStageAction, { id: "lead-1", to: "qualified", assignee: "x" }, state)).toMatchObject({
            ok: false,
            reason: "invalid",
        })
    })

    it("declares what it refreshes and that the front end may show the move before the answer", () => {
        expect(moveStageAction).toMatchObject({
            permission: "sales.manage",
            transactional: true,
            optimistic: true,
            refreshes: ["sales.leads", "sales.lead-counts", "sales.lead"],
        })
    })
})

describe("sales.confirm-order", () => {
    it("lets a staff member confirm a small draft, stamps who and when, and wins the customer's deal", async () => {
        const state = sampleState([])
        expect(await run(confirmOrderAction, { id: "order-2" }, state)).toEqual({ ok: true, data: { changed: true } })
        expect(state.orders.find((order) => order.id === "order-2")).toMatchObject({
            status: "confirmed",
            confirmedBy: STAFF,
            confirmedAt: SAMPLE_NOW,
        })
        expect(stageOf(state, "lead-1")).toBe("won")
    })

    it("makes an order at the threshold wait for the owner when a staff member confirms it", async () => {
        const state = sampleState([OWNER])
        expect(await run(confirmOrderAction, { id: "order-1" }, state)).toEqual({
            ok: false,
            reason: "refused",
            message: { key: "refusal_order_waits_owner" },
            data: { waiting: true, thresholdVnd: 5_000_000 },
        })
        expect(statusOf(state, "order-1")).toBe("draft")
        expect(stageOf(state, "lead-4")).toBe("proposal")
    })

    it("makes the agent's confirmation of a big order wait too", async () => {
        const state = sampleState([OWNER])
        expect(await run(confirmOrderAction, { id: "order-1" }, state, null)).toMatchObject({ ok: false })
        expect(statusOf(state, "order-1")).toBe("draft")
    })

    it("lets the owner confirm it", async () => {
        const state = sampleState([OWNER])
        expect(await run(confirmOrderAction, { id: "order-1" }, state, OWNER)).toEqual({
            ok: true,
            data: { changed: true },
        })
        expect(statusOf(state, "order-1")).toBe("confirmed")
        expect(stageOf(state, "lead-4")).toBe("won")
    })

    it("names the agent as the confirmer when no member confirmed", async () => {
        const state = sampleState([])
        await run(confirmOrderAction, { id: "order-2" }, state, null)
        expect(state.orders.find((order) => order.id === "order-2")?.confirmedBy).toBe("NIVO")
    })

    it("changes nothing for an order already confirmed", async () => {
        const state = sampleState([])
        expect(await run(confirmOrderAction, { id: "order-3" }, state)).toEqual({ ok: true, data: { changed: false } })
        expect(state.orders.find((order) => order.id === "order-3")?.version).toBe("1")
    })

    it("refuses a cancelled order and an order that does not exist", async () => {
        const state = sampleState([OWNER])
        expect(await run(confirmOrderAction, { id: "order-5" }, state, OWNER)).toMatchObject({
            message: { key: "refusal_order_not_confirmable" },
        })
        expect(await run(confirmOrderAction, { id: "order-404" }, state)).toMatchObject({
            message: { key: "refusal_missing" },
        })
    })

    it("keeps a lost deal lost and a won deal won", async () => {
        const state = sampleState([])
        state.leads.splice(0, 1, { ...LEAD_NEW, stage: "lost" })
        await run(confirmOrderAction, { id: "order-2" }, state)
        expect(stageOf(state, "lead-1")).toBe("lost")
        state.orders.push({ ...ORDER_WAITING, id: "order-9", leadId: "lead-5", amountVnd: 100_000 })
        expect(await run(confirmOrderAction, { id: "order-9" }, state)).toEqual({ ok: true, data: { changed: true } })
        expect(stageOf(state, "lead-5")).toBe("won")
        expect(state.leads.find((lead) => lead.id === "lead-5")?.version).toBe("1")
    })

    it("confirms an order with no customer, or whose customer is gone", async () => {
        const state = sampleState([])
        state.orders.push({ ...ORDER_WAITING, id: "order-8", leadId: null, amountVnd: 100_000 })
        state.orders.push({ ...ORDER_WAITING, id: "order-9", leadId: "lead-9", amountVnd: 100_000 })
        expect(await run(confirmOrderAction, { id: "order-8" }, state)).toEqual({ ok: true, data: { changed: true } })
        expect(await run(confirmOrderAction, { id: "order-9" }, state)).toEqual({ ok: true, data: { changed: true } })
    })

    it("answers an order that changed under it as a conflict, and one that vanished as missing", async () => {
        const state = sampleState([])
        const input = { id: "order-2" }
        expect(
            await execute(confirmOrderAction, failingUpdate(state, "sales.order-store", "conflict"), input, STAFF),
        ).toMatchObject({ reason: "conflict" })
        expect(
            await execute(confirmOrderAction, failingUpdate(state, "sales.order-store", "missing"), input, STAFF),
        ).toMatchObject({ message: { key: "refusal_missing" } })
    })

    it("answers a deal that changed under it as a conflict", async () => {
        const state = sampleState([])
        expect(
            await execute(
                confirmOrderAction,
                failingUpdate(state, "sales.lead-store", "conflict"),
                { id: "order-2" },
                STAFF,
            ),
        ).toMatchObject({ reason: "conflict" })
    })

    it("declares what it refreshes", () => {
        expect(confirmOrderAction).toMatchObject({ permission: "sales.manage", transactional: true })
        expect(confirmOrderAction.refreshes).toContain("sales.orders-waiting")
    })
})

describe("sales.cancel-order", () => {
    it("cancels a draft", async () => {
        const state = sampleState([])
        expect(await run(cancelOrderAction, { id: "order-2" }, state)).toEqual({ ok: true })
        expect(statusOf(state, "order-2")).toBe("cancelled")
    })

    it("refuses an order that is no draft and one that does not exist", async () => {
        const state = sampleState([])
        expect(await run(cancelOrderAction, { id: "order-3" }, state)).toMatchObject({
            message: { key: "refusal_order_not_cancellable" },
        })
        expect(await run(cancelOrderAction, { id: "order-404" }, state)).toMatchObject({
            message: { key: "refusal_missing" },
        })
    })

    it("answers an order that changed under it as a conflict, and one that vanished as missing", async () => {
        const state = sampleState([])
        const input = { id: "order-2" }
        expect(
            await execute(cancelOrderAction, failingUpdate(state, "sales.order-store", "conflict"), input, STAFF),
        ).toMatchObject({ reason: "conflict" })
        expect(
            await execute(cancelOrderAction, failingUpdate(state, "sales.order-store", "missing"), input, STAFF),
        ).toMatchObject({ message: { key: "refusal_missing" } })
    })
})
