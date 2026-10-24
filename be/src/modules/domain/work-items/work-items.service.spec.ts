import { WorkItemsErrorCode } from "./errors/work-items.error"
import { FakeClock, builder, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { WorkItemRow } from "./persistence/work-items.rows"
import {
    ASSIGN_WORK_ITEM,
    ATTACH_WORK_ITEM_EXECUTION,
    HOLD_WORK_ITEM,
    MARK_WORK_ITEM_DONE,
    MARK_WORK_ITEM_FAILED,
    MARK_WORK_ITEM_REJECTED,
    MARK_WORK_ITEM_STILL_WAITING,
    MARK_WORK_ITEM_WAITING,
    REOPEN_WAITING_WORK_ITEM,
    SAVE_PREPARED_WORK_ITEM,
    SETTLE_WAITING_CLAIMS,
    CLAIM_WORK_ITEM,
    FIND_LATEST_WORK_ITEM_OF_KEY,
    FIND_WORK_ITEM_BY_DEDUPE,
    INSERT_WORK_ITEM,
    LIST_ACCOUNTING_WORK_ITEMS,
    LIST_LEAD_ITEMS,
    LIST_WORKBENCH_ITEMS,
    LIST_WORKSPACES_WITH_QUEUED_WORK,
    NEXT_QUEUED_WORK_ITEM,
    NEXT_INBOUND_QUEUED_WORK_ITEM,
    READ_INBOUND_WORK_STATE,
    RETRY_WORK_ITEM,
    STOP_FAILED_WORK_ITEM,
} from "./persistence/work-items.sql"
import type { NewWorkItem, Proposal } from "./work-items.contracts"
import { WorkItemsService } from "./work-items.service"

const NOW = "2026-10-12T10:00:00.000Z"

const proposal: Proposal = { summary: "Quote", fields: { items: "tea" } }

const rowOf = builder<WorkItemRow>({
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
    created_at: new Date("2026-10-12T09:00:00.000Z"),
    updated_at: new Date("2026-10-12T09:00:00.000Z"),
    completed_at: null,
    installation_id: null,
})

const newItem: NewWorkItem = {
    workspaceId: "ws-1",
    chainId: null,
    depth: 0,
    department: "sales",
    action: "send_quote",
    subjectType: "lead",
    subjectId: "lead-1",
    leadId: "lead-1",
    inboundEventId: null,
    parentId: null,
    dedupeKey: "send_quote:lead-1",
    proposal,
    installationId: null,
}

const build = async (entityManager: MockEntityManager) => {
    const moduleRef = await Test.createTestingModule({
        providers: [
            WorkItemsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
        ],
    }).compile()
    return moduleRef.get(WorkItemsService)
}

describe("WorkItemsService persistence", () => {
    it("writes the queued item and answers it", async () => {
        const em = mockEntityManager({ query: [INSERT_WORK_ITEM, [rowOf()]] })

        const item = await (await build(em)).insert({ ...newItem, chainId: "chain-1", depth: 2 })

        expect(item?.created_at).toBe("2026-10-12T09:00:00.000Z")
        expect(em.query).toHaveBeenCalledWith(INSERT_WORK_ITEM, [
            "ws-1",
            "chain-1",
            2,
            "sales",
            "send_quote",
            "lead",
            "lead-1",
            "lead-1",
            null,
            null,
            "send_quote:lead-1",
            JSON.stringify(proposal),
            null,
        ])
    })

    it("answers nothing when the dedupe key is used", async () => {
        const service = await build(mockEntityManager({ query: [INSERT_WORK_ITEM, []] }))

        expect(await service.insert(newItem)).toBeNull()
    })

    it.each([
        { limit: undefined, expected: 400 },
        { limit: 0, expected: 1 },
        { limit: 1200, expected: 1000 },
        { limit: 25, expected: 25 },
    ])("bounds the workbench limit $limit to $expected", async ({ limit, expected }) => {
        const row = rowOf()
        const em = mockEntityManager({ query: [LIST_WORKBENCH_ITEMS, [row]] })

        expect(await (await build(em)).listForWorkbench("ws-1", limit)).toEqual([
            {
                ...row,
                created_at: row.created_at.toISOString(),
                updated_at: row.updated_at.toISOString(),
            },
        ])
        expect(em.query).toHaveBeenCalledWith(LIST_WORKBENCH_ITEMS, ["ws-1", expected])
    })

    it("lists the chronological items of one lead", async () => {
        const row = rowOf()
        const em = mockEntityManager({ query: [LIST_LEAD_ITEMS, [row]] })

        expect(await (await build(em)).listForLead("ws-1", "lead-1")).toEqual([
            {
                ...row,
                created_at: row.created_at.toISOString(),
                updated_at: row.updated_at.toISOString(),
            },
        ])
        expect(em.query).toHaveBeenCalledWith(LIST_LEAD_ITEMS, ["ws-1", "lead-1"])
    })
})

describe("WorkItemsService persistence", () => {
    it.each([undefined, 12])("lists accounting lineage with limit %s", async (limit) => {
        const rows = [{ id: "item-1", action: "reconcile_payment", status: "done" }]
        const em = mockEntityManager({ query: [LIST_ACCOUNTING_WORK_ITEMS, rows] })

        expect(await (await build(em)).listAccounting("ws-1", limit)).toEqual(rows)
        expect(em.query).toHaveBeenCalledWith(LIST_ACCOUNTING_WORK_ITEMS, ["ws-1", limit ?? 500])
    })

    it("retries only allowed states using the default or supplied manager", async () => {
        const em = mockEntityManager({ query: [RETRY_WORK_ITEM, [rowOf()]] })
        const tx = mockEntityManager({ query: [RETRY_WORK_ITEM, []] })
        const service = await build(em)

        expect((await service.retry("ws-1", "item-1", ["failed"]))?.id).toBe("item-1")
        expect(await service.retry("ws-1", "item-1", ["rejected"], tx)).toBeNull()
        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.query).toHaveBeenCalledWith(RETRY_WORK_ITEM, ["ws-1", "item-1", ["failed"]])
        expect(tx.query).toHaveBeenCalledWith(RETRY_WORK_ITEM, ["ws-1", "item-1", ["rejected"]])
    })

    it("stops failed work using the default or supplied manager", async () => {
        const em = mockEntityManager({ query: [STOP_FAILED_WORK_ITEM, [rowOf({ status: "rejected" })]] })
        const tx = mockEntityManager({ query: [STOP_FAILED_WORK_ITEM, []] })
        const service = await build(em)

        expect((await service.stopFailed("ws-1", "item-1"))?.status).toBe("rejected")
        expect(await service.stopFailed("ws-1", "item-1", tx)).toBeNull()
        expect(em.query).toHaveBeenCalledTimes(1)
        expect(em.query).toHaveBeenCalledWith(STOP_FAILED_WORK_ITEM, ["ws-1", "item-1", NOW])
        expect(tx.query).toHaveBeenCalledWith(STOP_FAILED_WORK_ITEM, ["ws-1", "item-1", NOW])
    })

    it("finds the latest action for a base dedupe key", async () => {
        const em = mockEntityManager({ query: [FIND_LATEST_WORK_ITEM_OF_KEY, [rowOf()]] })

        expect((await (await build(em)).latestOfKey("ws-1", "send_quote", "quote:lead-1"))?.id).toBe("item-1")
        expect(em.query).toHaveBeenCalledWith(FIND_LATEST_WORK_ITEM_OF_KEY, ["ws-1", "send_quote", "quote:lead-1"])
    })

    it("finds the next queued step of one inbound event", async () => {
        const em = mockEntityManager({ query: [NEXT_INBOUND_QUEUED_WORK_ITEM, [rowOf()]] })

        expect((await (await build(em)).nextInboundQueued("ws-1", "event-1"))?.id).toBe("item-1")
        expect(em.query).toHaveBeenCalledWith(NEXT_INBOUND_QUEUED_WORK_ITEM, ["ws-1", "event-1", NOW, 120])
    })

    it.each([
        { rows: [], expected: { queued: 0, failed: 0, waiting: 0 } },
        { rows: [{ queued: 2, failed: 1, waiting: 3 }], expected: { queued: 2, failed: 1, waiting: 3 } },
    ])("answers inbound counts, defaulting missing rows to zero", async ({ rows, expected }) => {
        const em = mockEntityManager({ query: [READ_INBOUND_WORK_STATE, rows] })

        expect(await (await build(em)).inboundState("ws-1", "event-1")).toEqual(expected)
        expect(em.query).toHaveBeenCalledWith(READ_INBOUND_WORK_STATE, ["ws-1", "event-1"])
    })

    it("finds the item of a dedupe key", async () => {
        const em = mockEntityManager({ query: [FIND_WORK_ITEM_BY_DEDUPE, [rowOf()]] })

        expect((await (await build(em)).findByDedupe("ws-1", "k"))?.id).toBe("item-1")
        expect(em.query).toHaveBeenCalledWith(FIND_WORK_ITEM_BY_DEDUPE, ["ws-1", "k"])
    })

    it("claims an item for two minutes, or answers nothing when it is held", async () => {
        const taken = mockEntityManager({ query: [CLAIM_WORK_ITEM, [rowOf()]] })
        const held = mockEntityManager({ query: [CLAIM_WORK_ITEM, []] })

        expect((await (await build(taken)).claim("ws-1", "item-1"))?.id).toBe("item-1")
        expect(taken.query).toHaveBeenCalledWith(CLAIM_WORK_ITEM, ["item-1", "ws-1", NOW, 120])
        expect(await (await build(held)).claim("ws-1", "item-1")).toBeNull()
    })
})

describe("WorkItemsService persistence", () => {
    it("lists the workspaces with free queued work, longest waiting first", async () => {
        const em = mockEntityManager({
            query: [LIST_WORKSPACES_WITH_QUEUED_WORK, [{ workspace_id: "ws-1" }, { workspace_id: "ws-2" }]],
        })

        expect(await (await build(em)).workspacesWithQueued(50)).toEqual(["ws-1", "ws-2"])
        expect(em.query).toHaveBeenCalledWith(LIST_WORKSPACES_WITH_QUEUED_WORK, [NOW, 120, 50])
    })

    it("finds the next free queued item", async () => {
        const em = mockEntityManager({ query: [NEXT_QUEUED_WORK_ITEM, [rowOf()]] })

        expect((await (await build(em)).nextQueued("ws-1"))?.id).toBe("item-1")
        expect(em.query).toHaveBeenCalledWith(NEXT_QUEUED_WORK_ITEM, ["ws-1", NOW, 120])
    })

    it("reopens an item that waits, and answers nothing for any other", async () => {
        const waiting = mockEntityManager({ query: [REOPEN_WAITING_WORK_ITEM, [rowOf()]] })
        const other = mockEntityManager({ query: [REOPEN_WAITING_WORK_ITEM, []] })

        expect((await (await build(waiting)).reopen("ws-1", "item-1"))?.id).toBe("item-1")
        expect(waiting.query).toHaveBeenCalledWith(REOPEN_WAITING_WORK_ITEM, ["item-1", "ws-1", NOW])
        expect(await (await build(other)).reopen("ws-1", "item-1")).toBeNull()
    })
})

describe("WorkItemsService holds and assignments", () => {
    it.each([
        { rows: [{ id: "item-1" }], expected: true },
        { rows: [], expected: false },
    ])("holds only an item that is still waiting", async ({ rows, expected }) => {
        const em = mockEntityManager({ query: [HOLD_WORK_ITEM, rows] })

        expect(await (await build(em)).hold("ws-1", "item-1", proposal)).toBe(expected)
        expect(em.query).toHaveBeenCalledWith(HOLD_WORK_ITEM, ["ws-1", "item-1", JSON.stringify(proposal), NOW])
    })

    it("writes a hold through the caller's transaction manager", async () => {
        const primary = mockEntityManager()
        const manager = mockEntityManager({ query: [HOLD_WORK_ITEM, [{ id: "item-1" }]] })

        expect(await (await build(primary)).hold("ws-1", "item-1", proposal, manager)).toBe(true)

        expect(primary.query).not.toHaveBeenCalled()
        expect(manager.query).toHaveBeenCalledWith(HOLD_WORK_ITEM, ["ws-1", "item-1", JSON.stringify(proposal), NOW])
    })

    it.each([
        { staffId: "staff-1", rows: [{ id: "item-1" }], expected: true },
        { staffId: null, rows: [{ id: "item-1" }], expected: true },
        { staffId: "staff-1", rows: [], expected: false },
    ])("assigns or clears a staff member only in the workspace", async ({ staffId, rows, expected }) => {
        const em = mockEntityManager({ query: [ASSIGN_WORK_ITEM, rows] })

        expect(await (await build(em)).assign("ws-1", "item-1", staffId)).toBe(expected)
        expect(em.query).toHaveBeenCalledWith(ASSIGN_WORK_ITEM, ["ws-1", "item-1", staffId, NOW])
    })

    it("attaches the execution that decided an item", async () => {
        const em = mockEntityManager({ query: [ATTACH_WORK_ITEM_EXECUTION, []] })

        await (await build(em)).attachExecution("ws-1", "item-1", "exec-1")

        expect(em.query).toHaveBeenCalledWith(ATTACH_WORK_ITEM_EXECUTION, ["ws-1", "item-1", "exec-1"])
    })

    it("settles waiting claims and returns the closed inbound items", async () => {
        const rows = [{ id: "claim-1", inbound_event_id: "event-1" }]
        const em = mockEntityManager({ query: [SETTLE_WAITING_CLAIMS, rows] })

        expect(
            await (await build(em)).settleClaims("ws-1", "payment-1", "claim:invoice-1", { summary: "Paid" }),
        ).toEqual(rows)
        expect(em.query).toHaveBeenCalledWith(SETTLE_WAITING_CLAIMS, [
            "ws-1",
            "payment-1",
            "claim:invoice-1",
            JSON.stringify({ summary: "Paid" }),
            NOW,
        ])
    })
})

describe("WorkItemsService persistence", () => {
    it("saves what the performer prepared", async () => {
        const em = mockEntityManager({ query: [SAVE_PREPARED_WORK_ITEM, [rowOf()]] })

        await (
            await build(em)
        ).savePrepared("item-1", { proposal, subjectType: "order", subjectId: "o-1", leadId: null })

        expect(em.query).toHaveBeenCalledWith(SAVE_PREPARED_WORK_ITEM, [
            "item-1",
            JSON.stringify(proposal),
            "order",
            "o-1",
            null,
            NOW,
        ])
    })

    it("marks an item failed", async () => {
        const em = mockEntityManager({ query: [MARK_WORK_ITEM_FAILED, [rowOf({ status: "failed" })]] })

        const item = await (await build(em)).markFailed("item-1", "boom")

        expect(item.status).toBe("failed")
        expect(em.query).toHaveBeenCalledWith(MARK_WORK_ITEM_FAILED, ["item-1", "boom", NOW])
    })

    it("puts an item in front of a person", async () => {
        const em = mockEntityManager({ query: [MARK_WORK_ITEM_WAITING, [rowOf({ status: "waiting_decision" })]] })

        await (
            await build(em)
        ).markWaiting("item-1", {
            reason: "missing_data",
            reasons: ["missing_data"],
            missing: ["need"],
            proposal,
            executionId: "exec-1",
        })

        expect(em.query).toHaveBeenCalledWith(MARK_WORK_ITEM_WAITING, [
            "item-1",
            "missing_data",
            ["missing_data"],
            ["need"],
            JSON.stringify(proposal),
            "exec-1",
            NOW,
        ])
    })
})

describe("WorkItemsService persistence", () => {
    it("closes an item as done", async () => {
        const em = mockEntityManager({ query: [MARK_WORK_ITEM_DONE, [rowOf({ status: "done" })]] })

        await (
            await build(em)
        ).markDone("item-1", {
            path: "auto",
            proposal,
            result: { summary: "Sent", href: "/q/1" },
            evidence: "captured",
            leadId: "lead-9",
        })

        expect(em.query).toHaveBeenCalledWith(MARK_WORK_ITEM_DONE, [
            "item-1",
            "auto",
            JSON.stringify(proposal),
            JSON.stringify({ summary: "Sent", href: "/q/1" }),
            "captured",
            NOW,
            "lead-9",
        ])
    })

    it("closes an item as rejected", async () => {
        const em = mockEntityManager({ query: [MARK_WORK_ITEM_REJECTED, [rowOf({ status: "rejected" })]] })

        await (await build(em)).markRejected("item-1", proposal, { summary: "No" })

        expect(em.query).toHaveBeenCalledWith(MARK_WORK_ITEM_REJECTED, [
            "item-1",
            JSON.stringify(proposal),
            NOW,
            JSON.stringify({ summary: "No" }),
        ])
    })

    it("is a typed not-found when the write answers no row", async () => {
        const service = await build(mockEntityManager({ query: [MARK_WORK_ITEM_FAILED, []] }))

        await expect(service.markFailed("item-1", "boom")).rejects.toThrow(WorkItemsErrorCode.NotFound)
    })

    it("puts an item back to waiting when data is still missing", async () => {
        const em = mockEntityManager({ query: [MARK_WORK_ITEM_STILL_WAITING, []] })

        await (
            await build(em)
        ).markStillWaiting("item-1", {
            proposal,
            missing: ["need"],
            reason: "missing_data",
            reasons: ["missing_data"],
        })

        expect(em.query).toHaveBeenCalledWith(MARK_WORK_ITEM_STILL_WAITING, [
            "item-1",
            JSON.stringify(proposal),
            ["need"],
            "missing_data",
            ["missing_data"],
            NOW,
        ])
    })
})
