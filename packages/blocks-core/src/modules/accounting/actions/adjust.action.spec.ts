import type { ActionResult } from "@nivo-lite/agent-sdk/block"
import type { RunContext } from "@nivo-lite/agent-sdk/port"
import { ADJUSTMENT, INVOICE } from "../../../rules/accounting/accounting.fixtures"
import type { NormalizedAdjustment } from "../../../rules/accounting/adjustment"
import { adjustmentStore, providerOf, recordingOutbox } from "../accounting.doubles"
import type { WriteResult } from "../accounting.types"
import { adjustmentsPort, outboxPort } from "../ports"
import { adjustAction } from "./adjust.action"
import type { AdjustmentRecord } from "../../../rules/accounting/accounting.types"

const context = (memberId: string | null): RunContext => ({
    workspaceId: "w1",
    memberId,
    now: new Date("2026-11-04T12:00:00.000Z"),
})

const NOT_RUNNABLE: ActionResult = { ok: false, reason: "failed", message: { key: "not_runnable" } }

interface Setup {
    readonly exists?: boolean
    readonly inserted?: WriteResult<AdjustmentRecord>
}

const harness = (setup: Setup = {}) => {
    const inserts: Array<{ values: NormalizedAdjustment; createdBy: string }> = []
    const { outbox, jobs } = recordingOutbox()
    const provider = providerOf([
        [
            adjustmentsPort,
            adjustmentStore({
                targetExists: () => Promise.resolve(setup.exists ?? true),
                insert: (values, createdBy) => {
                    inserts.push({ values, createdBy })
                    return Promise.resolve(setup.inserted ?? { ok: true, row: ADJUSTMENT })
                },
            }),
        ],
        [outboxPort, outbox],
    ])
    const run = (raw: unknown, memberId: string | null = "m1"): Promise<ActionResult> => {
        return adjustAction.execute?.(provider, raw, context(memberId)) ?? Promise.resolve(NOT_RUNNABLE)
    }
    return { inserts, jobs, run }
}

const payload = {
    targetType: "invoice",
    targetId: INVOICE.id,
    note: "  Discount agreed  by phone",
    correctedAmount: 1_800_000,
}

describe("accounting.adjust", () => {
    it("is a transactional action of the manage permission that refreshes the books", () => {
        expect(adjustAction.id).toBe("accounting.adjust")
        expect(adjustAction.permission).toBe("accounting.manage")
        expect(adjustAction.transactional).toBe(true)
        expect(adjustAction.refreshes).toEqual([
            "accounting.entries",
            "accounting.entry-counts",
            "accounting.status-counts",
            "accounting.weekly",
            "accounting.decisions",
            "accounting.figures",
            "accounting.entry",
        ])
    })

    it("records the correction by the member and enqueues its book entry", async () => {
        const { inserts, jobs, run } = harness()
        await expect(run(payload)).resolves.toEqual({ ok: true, data: { id: ADJUSTMENT.id } })
        expect(inserts).toEqual([
            {
                values: {
                    targetType: "invoice",
                    targetId: INVOICE.id,
                    note: "Discount agreed by phone",
                    correctedAmountVnd: 1_800_000,
                },
                createdBy: "m1",
            },
        ])
        expect(jobs).toEqual([
            {
                name: "accounting.book-project",
                input: { sourceEntity: "accounting.adjustment", sourceId: ADJUSTMENT.id },
                options: { dedupeKey: `book:accounting.adjustment:${ADJUSTMENT.id}` },
            },
        ])
    })

    it("credits the system when no member asked, and takes a note without an amount", async () => {
        const { inserts, run } = harness()
        await run({ targetType: "transaction", targetId: ADJUSTMENT.id, note: "Counted twice" }, null)
        expect(inserts[0]).toMatchObject({ createdBy: "system", values: { correctedAmountVnd: null } })
    })

    it("refuses a short note and a bad amount, naming the field", async () => {
        const { inserts, run } = harness()
        await expect(run({ ...payload, note: "ok" })).resolves.toEqual({
            ok: false,
            reason: "invalid",
            message: { key: "adjust_note_length" },
            fields: { note: { key: "adjust_note_length" } },
        })
        await expect(run({ ...payload, correctedAmount: -5 })).resolves.toEqual({
            ok: false,
            reason: "invalid",
            message: { key: "adjust_amount_invalid" },
            fields: { correctedAmount: { key: "adjust_amount_invalid" } },
        })
        expect(inserts).toEqual([])
    })

    it("refuses a record that is not there, and writes nothing", async () => {
        const { inserts, jobs, run } = harness({ exists: false })
        await expect(run(payload)).resolves.toEqual({
            ok: false,
            reason: "refused",
            message: { key: "adjust_target_missing" },
        })
        expect(inserts).toEqual([])
        expect(jobs).toEqual([])
    })

    it("fails when the correction cannot be saved", async () => {
        const { jobs, run } = harness({ inserted: { ok: false, reason: "invalid" } })
        await expect(run(payload)).resolves.toEqual({ ok: false, reason: "failed", message: { key: "adjust_failed" } })
        expect(jobs).toEqual([])
    })

    it("answers invalid for a payload the door should never have passed", async () => {
        const { run } = harness()
        await expect(run({ ...payload, targetType: "order" })).resolves.toMatchObject({ ok: false, reason: "invalid" })
    })
})
