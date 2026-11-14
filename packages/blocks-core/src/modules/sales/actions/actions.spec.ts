import type { ActionDefinition, ActionResult } from "@nivo-lite/agent-sdk/block"
import type { PortProvider } from "@nivo-lite/agent-sdk/port"
import { SALES_SETTINGS_DEFAULTS } from "../../../rules/sales/settings"
import type { SalesSettings } from "../../../rules/sales/settings"
import { LEAD_NEW, ORDER_CONFIRMED, ORDER_WAITING, sampleState, SAMPLE_NOW } from "../fixtures/sales.data"
import { salesContextOf } from "../fixtures/sales.context"
import { memoryProvider } from "../memory"
import type { MemoryState } from "../memory"
import { cancelOrderAction } from "./cancel-order.action"
import { confirmOrderAction } from "./confirm-order.action"
import { moveStageAction } from "./move-stage.action"
import { saveSettingsAction } from "./save-settings.action"

const OWNER = "owner-1"
const STAFF = "staff-1"

const execute = (
    action: ActionDefinition,
    provider: PortProvider,
    raw: unknown,
    memberId: string | null,
): Promise<ActionResult> => {
    return (
        action.execute?.(provider, raw, salesContextOf(memberId)) ??
        Promise.resolve({ ok: false, reason: "failed", message: { key: "not_run" } })
    )
}

const run = (
    action: ActionDefinition,
    raw: unknown,
    state: MemoryState,
    memberId: string | null = STAFF,
): Promise<ActionResult> => execute(action, memoryProvider(state), raw, memberId)

/** A provider whose entity port under `portId` answers every update with the given failure. */
const failingUpdate = (state: MemoryState, portId: string, reason: "stale" | "missing"): PortProvider => {
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

/** A state whose workspace saved the defaults changed by the given settings. */
const withSettings = (changes: Partial<SalesSettings>): MemoryState => ({
    ...sampleState([]),
    settings: { ...SALES_SETTINGS_DEFAULTS, ...changes },
})

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
            message: { key: "refusal_reopen_needs_owner" },
        })
        expect(stageOf(state, "lead-4")).toBe("proposal")
    })

    it("lets the owner reopen a closed deal, and anyone when the settings do not ask for the owner", async () => {
        const state = sampleState([OWNER])
        expect(await run(moveStageAction, { id: "lead-5", to: "new" }, state, OWNER)).toEqual({
            ok: true,
            data: { stage: "new" },
        })
        const open = withSettings({ reopenNeedsApproval: false })
        expect(await run(moveStageAction, { id: "lead-5", to: "qualified" }, open)).toEqual({
            ok: true,
            data: { stage: "qualified" },
        })
    })

    it("refuses to switch a closed deal between won and lost when the settings forbid it", async () => {
        expect(
            await run(
                moveStageAction,
                { id: "lead-5", to: "lost", reason: "refunded" },
                withSettings({ closedDealsCanFlip: false }),
            ),
        ).toMatchObject({ message: { key: "refusal_stage_not_allowed" } })
        expect(
            await run(moveStageAction, { id: "lead-5", to: "lost", reason: "refunded" }, sampleState([])),
        ).toMatchObject({ ok: true })
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
            await execute(moveStageAction, failingUpdate(state, "engine.entity.blocks-core.sales.lead", "stale"), input, STAFF),
        ).toMatchObject({ ok: false, reason: "conflict" })
        expect(
            await execute(moveStageAction, failingUpdate(state, "engine.entity.blocks-core.sales.lead", "missing"), input, STAFF),
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
            refreshes: ["blocks-core.sales.api.lead.list", "blocks-core.sales.api.lead.counts", "blocks-core.sales.api.lead.get"],
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

    it("follows the threshold the workspace saved, and tells it", async () => {
        const state = withSettings({ approvalThresholdVnd: 300_000 })
        expect(await run(confirmOrderAction, { id: "order-2" }, state)).toEqual({
            ok: false,
            reason: "refused",
            message: { key: "refusal_order_waits_owner" },
            data: { waiting: true, thresholdVnd: 300_000 },
        })
        expect(
            await run(confirmOrderAction, { id: "order-1" }, withSettings({ approvalThresholdVnd: 7_000_000 })),
        ).toEqual({
            ok: true,
            data: { changed: true },
        })
    })

    it("lets staff confirm an order with no total when the settings say it need not wait", async () => {
        const state = withSettings({ draftWithoutTotalNeedsApproval: false })
        state.orders.push({ ...ORDER_WAITING, id: "order-9", contactId: null, amountVnd: null })
        expect(await run(confirmOrderAction, { id: "order-9" }, state)).toEqual({ ok: true, data: { changed: true } })
        const strict = sampleState([])
        strict.orders.push({ ...ORDER_WAITING, id: "order-9", contactId: null, amountVnd: null })
        expect(await run(confirmOrderAction, { id: "order-9" }, strict)).toMatchObject({ ok: false })
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
        state.orders.push({ ...ORDER_WAITING, id: "order-9", contactId: "contact-lead-5", amountVnd: 100_000 })
        expect(await run(confirmOrderAction, { id: "order-9" }, state)).toEqual({ ok: true, data: { changed: true } })
        expect(stageOf(state, "lead-5")).toBe("won")
        expect(state.leads.find((lead) => lead.id === "lead-5")?.version).toBe("1")
    })

    it("confirms an order with no customer, or whose customer is gone", async () => {
        const state = sampleState([])
        state.orders.push({ ...ORDER_WAITING, id: "order-8", contactId: null, amountVnd: 100_000 })
        state.orders.push({ ...ORDER_WAITING, id: "order-9", contactId: "contact-lead-9", amountVnd: 100_000 })
        expect(await run(confirmOrderAction, { id: "order-8" }, state)).toEqual({ ok: true, data: { changed: true } })
        expect(await run(confirmOrderAction, { id: "order-9" }, state)).toEqual({ ok: true, data: { changed: true } })
    })

    it("answers an order that changed under it as a conflict, and one that vanished as missing", async () => {
        const state = sampleState([])
        const input = { id: "order-2" }
        expect(
            await execute(confirmOrderAction, failingUpdate(state, "engine.entity.blocks-core.sales.order", "stale"), input, STAFF),
        ).toMatchObject({ reason: "conflict" })
        expect(
            await execute(
                confirmOrderAction,
                failingUpdate(state, "engine.entity.blocks-core.sales.order", "missing"),
                input,
                STAFF,
            ),
        ).toMatchObject({ message: { key: "refusal_missing" } })
    })

    it("answers a deal that changed under it as a conflict", async () => {
        const state = sampleState([])
        expect(
            await execute(
                confirmOrderAction,
                failingUpdate(state, "engine.entity.blocks-core.sales.lead", "stale"),
                { id: "order-2" },
                STAFF,
            ),
        ).toMatchObject({ reason: "conflict" })
    })

    it("declares what it refreshes", () => {
        expect(confirmOrderAction).toMatchObject({ permission: "sales.manage", transactional: true })
        expect(confirmOrderAction.refreshes).toContain("blocks-core.sales.api.order.waiting")
    })
})

describe("sales.cancel-order", () => {
    it("cancels a draft", async () => {
        const state = sampleState([])
        expect(await run(cancelOrderAction, { id: "order-2" }, state)).toEqual({ ok: true })
        expect(statusOf(state, "order-2")).toBe("cancelled")
    })

    it("cancels a confirmed order nobody paid or invoiced, and withdraws the claims still open on it", async () => {
        const state = sampleState([])
        const claim = (id: string, orderId: string, status: string): (typeof state.claims)[number] => ({
            id,
            orderId,
            status,
            version: "1",
            createdAt: SAMPLE_NOW,
            updatedAt: SAMPLE_NOW,
        })
        state.claims.push(
            claim("c-open", "order-3", "open"),
            claim("c-esc", "order-3", "escalated"),
            claim("c-settled", "order-3", "settled"),
            claim("c-other", "order-4", "open"),
        )
        expect(await run(cancelOrderAction, { id: "order-3" }, state)).toEqual({ ok: true })
        expect(statusOf(state, "order-3")).toBe("cancelled")
        expect(state.claims.map((c) => [c.id, c.status])).toEqual([
            ["c-open", "withdrawn"],
            ["c-esc", "withdrawn"],
            ["c-settled", "settled"],
            ["c-other", "open"],
        ])
    })

    it("answers a claim that changed under it as a conflict", async () => {
        const state = sampleState([])
        state.claims.push({
            id: "c-open",
            orderId: "order-3",
            status: "open",
            version: "1",
            createdAt: SAMPLE_NOW,
            updatedAt: SAMPLE_NOW,
        })
        expect(
            await execute(
                cancelOrderAction,
                failingUpdate(state, "engine.entity.blocks-core.sales.claim", "stale"),
                { id: "order-3" },
                STAFF,
            ),
        ).toMatchObject({ reason: "conflict" })
    })

    it("refuses a confirmed order that has a payment allocated or an invoice issued, and leaves it confirmed", async () => {
        const link = {
            id: "l-1",
            orderId: "order-3",
            status: "x",
            version: "1",
            createdAt: SAMPLE_NOW,
            updatedAt: SAMPLE_NOW,
        }
        const paid = sampleState([])
        paid.transactions.push(link)
        expect(await run(cancelOrderAction, { id: "order-3" }, paid)).toMatchObject({
            message: { key: "refusal_order_has_payment" },
        })
        const invoiced = sampleState([])
        invoiced.invoices.push(link)
        expect(await run(cancelOrderAction, { id: "order-3" }, invoiced)).toMatchObject({
            message: { key: "refusal_order_has_invoice" },
        })
        expect(statusOf(paid, "order-3")).toBe("confirmed")
        expect(statusOf(invoiced, "order-3")).toBe("confirmed")
    })

    it("refuses a paid order and a cancelled one", async () => {
        const state = sampleState([])
        expect(await run(cancelOrderAction, { id: "order-4" }, state)).toMatchObject({
            message: { key: "refusal_order_paid" },
        })
        expect(await run(cancelOrderAction, { id: "order-5" }, state)).toMatchObject({
            message: { key: "refusal_order_not_cancellable" },
        })
        const invoiced = sampleState([])
        invoiced.orders.splice(2, 1, { ...ORDER_CONFIRMED, status: "invoiced" })
        expect(await run(cancelOrderAction, { id: "order-3" }, invoiced)).toMatchObject({
            message: { key: "refusal_order_invoiced" },
        })
    })

    it("refuses an order that does not exist", async () => {
        const state = sampleState([])
        expect(await run(cancelOrderAction, { id: "order-404" }, state)).toMatchObject({
            message: { key: "refusal_missing" },
        })
    })

    it("answers an order that changed under it as a conflict, and one that vanished as missing", async () => {
        const state = sampleState([])
        const input = { id: "order-2" }
        expect(
            await execute(cancelOrderAction, failingUpdate(state, "engine.entity.blocks-core.sales.order", "stale"), input, STAFF),
        ).toMatchObject({ reason: "conflict" })
        expect(
            await execute(
                cancelOrderAction,
                failingUpdate(state, "engine.entity.blocks-core.sales.order", "missing"),
                input,
                STAFF,
            ),
        ).toMatchObject({ message: { key: "refusal_missing" } })
    })
})

describe("sales.save-settings", () => {
    it("saves the values given and keeps the saved ones for what is left empty", async () => {
        const state = sampleState([])
        expect(
            await run(saveSettingsAction, { approvalThresholdVnd: 1_000_000, closedDealsCanFlip: false }, state),
        ).toEqual({
            ok: true,
        })
        expect(state.settings).toEqual({
            ...SALES_SETTINGS_DEFAULTS,
            approvalThresholdVnd: 1_000_000,
            closedDealsCanFlip: false,
        })
        expect(
            await run(
                saveSettingsAction,
                {
                    id: "",
                    approvalThresholdVnd: null,
                    draftWithoutTotalNeedsApproval: false,
                    reopenNeedsApproval: null,
                },
                state,
            ),
        ).toEqual({ ok: true })
        expect(state.settings).toEqual({
            approvalThresholdVnd: 1_000_000,
            draftWithoutTotalNeedsApproval: false,
            closedDealsCanFlip: false,
            reopenNeedsApproval: true,
            maxDiscountPct: 10,
            remindAfterDays: 3,
            autoWon: true,
            notifyAccounting: true,
        })
    })

    it("saves the new rules of the quote, the reminder, the deal and the hand-over", async () => {
        const state = sampleState([])
        await run(
            saveSettingsAction,
            { maxDiscountPct: 15, remindAfterDays: 5, autoWon: false, notifyAccounting: false },
            state,
        )
        expect(state.settings).toMatchObject({
            maxDiscountPct: 15,
            remindAfterDays: 5,
            autoWon: false,
            notifyAccounting: false,
        })
        expect(await run(saveSettingsAction, { maxDiscountPct: 101 }, state)).toMatchObject({ reason: "invalid" })
        expect(await run(saveSettingsAction, { remindAfterDays: 0 }, state)).toMatchObject({ reason: "invalid" })
    })

    it("takes effect on the next confirmation", async () => {
        const state = sampleState([])
        await run(saveSettingsAction, { approvalThresholdVnd: 100_000 }, state)
        expect(await run(confirmOrderAction, { id: "order-2" }, state)).toMatchObject({ ok: false })
    })

    it("refuses a threshold out of range", async () => {
        expect(await run(saveSettingsAction, { approvalThresholdVnd: -1 }, sampleState([]))).toMatchObject({
            ok: false,
            reason: "invalid",
        })
    })

    it("declares who may save it and what it refreshes", () => {
        expect(saveSettingsAction).toMatchObject({ permission: "sales.manage", transactional: true })
        expect(saveSettingsAction.refreshes).toContain("blocks-core.sales.api.settings.get")
        expect(saveSettingsAction.refreshes).toContain("blocks-core.sales.api.order.waiting")
    })
})
