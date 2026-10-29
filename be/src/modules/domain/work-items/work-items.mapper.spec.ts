import { Test } from "@nestjs/testing"
import { builder } from "@starci/jest-preset"
import { WorkItemsErrorCode } from "./errors/work-items.error"
import type { WorkItemRecord } from "./work-items.contracts"
import { toProposal, toWorkItem, requireWorkItem } from "./work-items.mapper"

const SUBJECT = Symbol("work-items.mapper")

const build = async () => {
    const moduleRef = await Test.createTestingModule({
        providers: [{ provide: SUBJECT, useValue: { toProposal, toWorkItem, requireWorkItem } }],
    }).compile()
    return moduleRef.get<typeof import("./work-items.mapper")>(SUBJECT)
}

const rowOf = builder<WorkItemRecord>({
    id: "item-1",
    workspace_id: "ws-1",
    department: "sales",
    action: "send_quote",
    subject_type: "lead",
    subject_id: "lead-1",
    lead_id: "lead-1",
    inbound_event_id: null,
    parent_id: null,
    chain_id: "item-1",
    depth: 0,
    status: "queued",
    decided_path: null,
    reason: null,
    reasons: [],
    missing_fields: [],
    proposal: { summary: "Quote", fields: { items: "tea" } },
    result: null,
    error: null,
    evidence_state: "pending",
    assigned_staff_id: null,
    execution_id: null,
    created_at: new Date("2026-10-12T10:00:00.000Z"),
    updated_at: new Date("2026-10-12T10:01:00.000Z"),
    completed_at: null,
    installation_id: null,
})

describe("work item mapper", () => {
    describe("toProposal", () => {
        it("gives an empty stored proposal its defaults", async () => {
            const subject = await build()

            expect(subject.toProposal({})).toEqual({ summary: "", fields: {} })
        })

        it("keeps what is stored", async () => {
            const subject = await build()

            expect(subject.toProposal({ summary: "S", fields: { a: 1 }, draft: "D" })).toEqual({
                summary: "S",
                fields: { a: 1 },
                draft: "D",
            })
        })
    })

    describe("toWorkItem", () => {
        it("turns the timestamps into ISO strings", async () => {
            const subject = await build()

            const item = subject.toWorkItem(rowOf())
            expect(item.created_at).toBe("2026-10-12T10:00:00.000Z")
            expect(item.updated_at).toBe("2026-10-12T10:01:00.000Z")
            expect(item.completed_at).toBeNull()
            expect(item.proposal).toEqual({ summary: "Quote", fields: { items: "tea" } })
        })

        it("converts the completion time when there is one", async () => {
            const subject = await build()

            const item = subject.toWorkItem(rowOf({ completed_at: new Date("2026-10-12T11:00:00.000Z"), proposal: {} }))
            expect(item.completed_at).toBe("2026-10-12T11:00:00.000Z")
            expect(item.proposal).toEqual({ summary: "", fields: {} })
        })
    })

    describe("requireWorkItem", () => {
        it("answers the first row as an item", async () => {
            const subject = await build()

            expect(subject.requireWorkItem([rowOf({ id: "a" }), rowOf({ id: "b" })]).id).toBe("a")
        })

        it("is a typed not-found without a row", async () => {
            const subject = await build()

            expect(() => subject.requireWorkItem([])).toThrow(WorkItemsErrorCode.NotFound)
        })
    })
})
