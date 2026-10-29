import { WorkItemsErrorCode } from "./errors/work-items.error"
import { FakeClock, fakeIds, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { In, Like } from "typeorm"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import {
    AT,
    NOW,
    MINTED,
    anyFunction,
    contractOf,
    entityOf,
    insertedValues,
    managerAnswering,
    newItem,
    proposal,
    returned,
    rowOf,
    singleCall,
} from "@tests/fixtures/builders/work-items.builder"
import { WorkItemEntity } from "./persistence/entities"
import { WorkItemsService } from "./work-items.service"

const providersOf = (entityManager: MockEntityManager) => [
    WorkItemsService,
    { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
    { provide: CLOCK, useValue: new FakeClock(NOW) },
    { provide: IDS, useValue: fakeIds() },
]

const build = async (entityManager: MockEntityManager) =>
    (await Test.createTestingModule({ providers: providersOf(entityManager) }).compile()).get(WorkItemsService)

describe("WorkItemsService persistence", () => {
    it("writes the queued item in one statement that ignores a used dedupe key, and answers it", async () => {
        const { em, fake } = managerAnswering(returned([rowOf()]))

        const item = await (await build(em)).insert({ ...newItem, chainId: "chain-1", depth: 2 })

        expect(item?.created_at).toBe("2026-10-12T09:00:00.000Z")
        expect(em.createQueryBuilder).toHaveBeenCalledWith(WorkItemEntity, "w")
        expect(fake.callsOf("insert")).toEqual([[]])
        expect(singleCall(fake, "values")).toEqual(insertedValues({ chainId: "chain-1", depth: 2 }))
        expect(fake.callsOf("orIgnore")).toEqual([[]])
        expect(fake.callsOf("returning")).toEqual([["*"]])
    })

    it("makes a root item the root of its own chain", async () => {
        const { em, fake } = managerAnswering(returned([rowOf()]))

        await (await build(em)).insert(newItem)

        expect(fake.callsOf("values")[0]?.[0]).toMatchObject({ id: MINTED, chainId: MINTED })
    })

    it("answers nothing when the dedupe key is used", async () => {
        const service = await build(managerAnswering(returned([])).em)

        expect(await service.insert(newItem)).toBeNull()
    })

    it("inserts and reads the durable item through the caller's transaction", async () => {
        const primary = mockEntityManager()
        const { em: tx } = managerAnswering(
            returned([rowOf()]),
            mockEntityManager({ findOne: [WorkItemEntity, entityOf()] }),
        )
        const service = await build(primary)

        expect((await service.insert(newItem, tx))?.id).toBe("item-1")
        expect((await service.findByDedupe("ws-1", "send_quote:lead-1", tx))?.id).toBe("item-1")

        expect(primary.createQueryBuilder).not.toHaveBeenCalled()
        expect(primary.findOne).not.toHaveBeenCalled()
        expect(tx.findOne).toHaveBeenCalledWith(WorkItemEntity, {
            where: { workspaceId: "ws-1", dedupeKey: "send_quote:lead-1" },
        })
    })
})

describe("WorkItemsService listing", () => {
    it.each([
        { limit: undefined, expected: 400 },
        { limit: 0, expected: 1 },
        { limit: 1200, expected: 1000 },
        { limit: 25, expected: 25 },
    ])("bounds the workbench limit $limit to $expected", async ({ limit, expected }) => {
        const em = mockEntityManager({ find: [WorkItemEntity, [entityOf()]] })

        expect(await (await build(em)).listForWorkbench("ws-1", limit)).toEqual([contractOf()])
        expect(em.find).toHaveBeenCalledWith(WorkItemEntity, {
            where: { workspaceId: "ws-1" },
            order: { createdAt: "DESC", id: "DESC" },
            take: expected,
        })
    })

    it("lists the chronological items of one lead", async () => {
        const em = mockEntityManager({ find: [WorkItemEntity, [entityOf()]] })

        expect(await (await build(em)).listForLead("ws-1", "lead-1")).toEqual([contractOf()])
        expect(em.find).toHaveBeenCalledWith(WorkItemEntity, {
            where: { workspaceId: "ws-1", leadId: "lead-1" },
            order: { createdAt: "ASC", id: "ASC" },
            take: 500,
        })
    })

    it("answers the items of the given ids", async () => {
        const em = mockEntityManager({ find: [WorkItemEntity, [entityOf()]] })

        expect(await (await build(em)).findMany(["item-1", "item-2"], 200)).toEqual([contractOf()])
        expect(em.find).toHaveBeenCalledWith(WorkItemEntity, { where: { id: In(["item-1", "item-2"]) }, take: 200 })
    })

    it("counts the items of an action under a dedupe prefix", async () => {
        const em = mockEntityManager({ count: [WorkItemEntity, 3] })

        expect(await (await build(em)).countByDedupePrefix("ws-1", "ask", "ask:lead-1")).toBe(3)
        expect(em.count).toHaveBeenCalledWith(WorkItemEntity, {
            where: { workspaceId: "ws-1", action: "ask", dedupeKey: Like("ask:lead-1%") },
        })
    })
})

describe("WorkItemsService persistence", () => {
    it.each([undefined, 12])("lists accounting lineage with limit %s, the instant as database text", async (limit) => {
        const rows = [{ id: "item-1", action: "reconcile_payment", status: "done" }]
        const { em, fake } = managerAnswering({ getRawMany: rows })

        expect(await (await build(em)).listAccounting("ws-1", limit)).toEqual(rows)
        expect(fake.callsOf("select")[0]?.[0]).toContain("to_json(w.created_at) #>> '{}' AS created_at")
        expect(fake.callsOf("where")).toEqual([
            ["w.workspace_id = :workspaceId AND w.department = 'accounting'", { workspaceId: "ws-1" }],
        ])
        expect(fake.callsOf("limit")).toEqual([[limit ?? 500]])
    })

    it("retries only allowed states using the default or supplied manager", async () => {
        const { em, fake } = managerAnswering(returned([rowOf()]))
        const { em: tx } = managerAnswering(returned([]))
        const service = await build(em)

        expect((await service.retry("ws-1", "item-1", ["failed"]))?.id).toBe("item-1")
        expect(await service.retry("ws-1", "item-1", ["rejected"], tx)).toBeNull()
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(singleCall(fake, "set")).toEqual({
            status: "queued",
            error: null,
            reason: null,
            reasons: [],
            completedAt: null,
            updatedAt: anyFunction(),
        })
        expect(fake.callsOf("where")).toEqual([
            [
                "workspace_id = :workspaceId AND id = :id AND status = ANY(:allowed)",
                { id: "item-1", workspaceId: "ws-1" },
            ],
        ])
        expect(fake.callsOf("setParameters")).toEqual([[{ allowed: ["failed"] }]])
        expect(fake.callsOf("returning")).toEqual([["*"]])
    })

    it("stops failed work using the default or supplied manager", async () => {
        const { em, fake } = managerAnswering(returned([rowOf({ status: "rejected" })]))
        const { em: tx, fake: txFake } = managerAnswering(returned([]))
        const service = await build(em)

        expect((await service.stopFailed("ws-1", "item-1"))?.status).toBe("rejected")
        expect(await service.stopFailed("ws-1", "item-1", tx)).toBeNull()
        expect(em.createQueryBuilder).toHaveBeenCalledTimes(1)
        expect(singleCall(fake, "set")).toEqual({ status: "rejected", completedAt: AT, updatedAt: AT })
        expect(fake.callsOf("where")[0]?.[0]).toBe("workspace_id = :workspaceId AND id = :id AND status = 'failed'")
        expect(txFake.callsOf("set")).toHaveLength(1)
    })
})

describe("WorkItemsService lookups", () => {
    it("finds the latest action for a base dedupe key", async () => {
        const { em, fake } = managerAnswering({ getOne: entityOf() })

        expect((await (await build(em)).latestOfKey("ws-1", "send_quote", "quote:lead-1"))?.id).toBe("item-1")
        expect(fake.callsOf("where")).toEqual([
            ["w.workspace_id = :workspaceId AND w.action = :action", { workspaceId: "ws-1", action: "send_quote" }],
        ])
        expect(fake.callsOf("andWhere")[0]?.[1]).toEqual({ baseKey: "quote:lead-1" })
        expect(fake.callsOf("orderBy")).toEqual([["w.created_at", "DESC"]])
    })

    it("answers nothing when no item stands for the key", async () => {
        const { em } = managerAnswering({ getOne: null })

        expect(await (await build(em)).latestOfKey("ws-1", "send_quote", "none")).toBeNull()
    })

    it("finds the next queued step of one inbound event", async () => {
        const { em, fake } = managerAnswering({ getOne: entityOf() })

        expect((await (await build(em)).nextInboundQueued("ws-1", "event-1"))?.id).toBe("item-1")
        expect(fake.callsOf("andWhere")).toEqual([
            [expect.stringContaining("w.updated_at = w.created_at"), { now: AT, lease: 120 }],
            ["w.inbound_event_id = :eventId", { eventId: "event-1" }],
        ])
        expect(fake.callsOf("limit")).toEqual([[1]])
    })

    it.each([
        { row: undefined, expected: { queued: 0, failed: 0, waiting: 0 } },
        { row: { queued: 2, failed: 1, waiting: 3 }, expected: { queued: 2, failed: 1, waiting: 3 } },
    ])("answers inbound counts, defaulting a missing row to zero", async ({ row, expected }) => {
        const { em, fake } = managerAnswering({ getRawOne: row })

        expect(await (await build(em)).inboundState("ws-1", "event-1")).toEqual(expected)
        expect(fake.callsOf("where")).toEqual([
            [
                "w.workspace_id = :workspaceId AND w.inbound_event_id = :eventId",
                { workspaceId: "ws-1", eventId: "event-1" },
            ],
        ])
    })

    it("finds the item of a dedupe key", async () => {
        const em = mockEntityManager({ findOne: [WorkItemEntity, entityOf()] })

        expect((await (await build(em)).findByDedupe("ws-1", "k"))?.id).toBe("item-1")
        expect(em.findOne).toHaveBeenCalledWith(WorkItemEntity, { where: { workspaceId: "ws-1", dedupeKey: "k" } })
    })

    it("answers nothing for a dedupe key nobody used", async () => {
        const em = mockEntityManager({ findOne: [WorkItemEntity, null] })

        expect(await (await build(em)).findByDedupe("ws-1", "k")).toBeNull()
    })

    it("claims an item for two minutes, or answers nothing when it is held", async () => {
        const taken = managerAnswering(returned([rowOf()]))
        const held = managerAnswering(returned([]))

        expect((await (await build(taken.em)).claim("ws-1", "item-1"))?.id).toBe("item-1")
        expect(singleCall(taken.fake, "set")).toEqual({ updatedAt: AT })
        expect(taken.fake.callsOf("where")[0]?.[0]).toContain(
            "status = 'queued' AND (updated_at = created_at OR updated_at <",
        )
        expect(taken.fake.callsOf("setParameters")).toEqual([[{ now: AT, lease: 120 }]])
        expect(await (await build(held.em)).claim("ws-1", "item-1")).toBeNull()
    })
})

describe("WorkItemsService persistence", () => {
    it("lists the workspaces with free queued work, longest waiting first", async () => {
        const { em, fake } = managerAnswering({ getRawMany: [{ workspace_id: "ws-1" }, { workspace_id: "ws-2" }] })

        expect(await (await build(em)).workspacesWithQueued(50)).toEqual(["ws-1", "ws-2"])
        expect(fake.callsOf("groupBy")).toEqual([["w.workspace_id"]])
        expect(fake.callsOf("orderBy")).toEqual([["min(w.created_at)", "ASC"]])
        expect(fake.callsOf("limit")).toEqual([[50]])
        expect(fake.callsOf("andWhere")[0]?.[1]).toEqual({ now: AT, lease: 120 })
    })

    it("finds the next free queued item", async () => {
        const { em, fake } = managerAnswering({ getOne: entityOf() })

        expect((await (await build(em)).nextQueued("ws-1"))?.id).toBe("item-1")
        expect(fake.callsOf("where")).toEqual([
            ["w.workspace_id = :workspaceId AND w.status = 'queued' AND w.reason IS NULL", { workspaceId: "ws-1" }],
        ])
        expect(fake.callsOf("orderBy")).toEqual([["w.created_at", "ASC"]])
        expect(fake.callsOf("addOrderBy")).toEqual([["w.id", "ASC"]])
    })

    it("reopens an item that waits, and answers nothing for any other", async () => {
        const waiting = managerAnswering(returned([rowOf()]))
        const other = managerAnswering(returned([]))

        expect((await (await build(waiting.em)).reopen("ws-1", "item-1"))?.id).toBe("item-1")
        expect(singleCall(waiting.fake, "set")).toEqual({ status: "queued", updatedAt: AT })
        expect(waiting.fake.callsOf("where")[0]?.[0]).toBe(
            "workspace_id = :workspaceId AND id = :id AND status = 'waiting_decision'",
        )
        expect(await (await build(other.em)).reopen("ws-1", "item-1")).toBeNull()
    })
})

describe("WorkItemsService holds and assignments", () => {
    it.each([
        { rows: [{ id: "item-1" }], expected: true },
        { rows: [], expected: false },
    ])("holds only an item that is still waiting", async ({ rows, expected }) => {
        const { em, fake } = managerAnswering(returned(rows))

        expect(await (await build(em)).hold("ws-1", "item-1", proposal)).toBe(expected)
        expect(singleCall(fake, "set")).toEqual({ proposal, updatedAt: AT })
        expect(fake.callsOf("where")[0]?.[0]).toContain("status = 'waiting_decision'")
        expect(fake.callsOf("returning")).toEqual([["id"]])
    })

    it("writes a hold through the caller's transaction manager", async () => {
        const primary = mockEntityManager()
        const { em: manager } = managerAnswering(returned([{ id: "item-1" }]))

        expect(await (await build(primary)).hold("ws-1", "item-1", proposal, manager)).toBe(true)

        expect(primary.createQueryBuilder).not.toHaveBeenCalled()
        expect(manager.createQueryBuilder).toHaveBeenCalledTimes(1)
    })

    it.each([
        { staffId: "staff-1", rows: [{ id: "item-1" }], expected: true },
        { staffId: null, rows: [{ id: "item-1" }], expected: true },
        { staffId: "staff-1", rows: [], expected: false },
    ])("assigns or clears a staff member only in the workspace", async ({ staffId, rows, expected }) => {
        const { em, fake } = managerAnswering(returned(rows))

        expect(await (await build(em)).assign("ws-1", "item-1", staffId)).toBe(expected)
        expect(singleCall(fake, "set")).toEqual({ assignedStaffId: staffId, updatedAt: AT })
        expect(fake.callsOf("where")[0]?.[1]).toEqual({ workspaceId: "ws-1", id: "item-1" })
    })

    it("attaches the execution that decided an item", async () => {
        const em = mockEntityManager({ update: [WorkItemEntity, { affected: 1, raw: [], generatedMaps: [] }] })

        await (await build(em)).attachExecution("ws-1", "item-1", "exec-1")

        expect(em.update).toHaveBeenCalledWith(
            WorkItemEntity,
            { workspaceId: "ws-1", id: "item-1" },
            { executionId: "exec-1" },
        )
    })

    it("settles waiting claims and returns the closed inbound items", async () => {
        const rows = [{ id: "claim-1", inbound_event_id: "event-1" }]
        const { em, fake } = managerAnswering(returned(rows))

        expect(
            await (await build(em)).settleClaims("ws-1", "payment-1", "claim:invoice-1", { summary: "Paid" }),
        ).toEqual(rows)
        expect(singleCall(fake, "set")).toEqual({
            status: "done",
            decidedPath: "auto",
            reason: "routine",
            completedAt: AT,
            updatedAt: AT,
            evidenceState: "verified",
            result: { summary: "Paid" },
        })
        expect(fake.callsOf("where")[0]?.[1]).toEqual({
            workspaceId: "ws-1",
            settledBy: "payment-1",
            dedupePrefix: "claim:invoice-1",
        })
        expect(fake.callsOf("returning")).toEqual([["id, inbound_event_id"]])
    })
})

describe("WorkItemsService persistence", () => {
    it("saves what the performer prepared and keeps the address a null does not correct", async () => {
        const { em, fake } = managerAnswering(returned([rowOf()]))

        await (
            await build(em)
        ).savePrepared("item-1", { proposal, subjectType: "order", subjectId: "o-1", leadId: null })

        expect(singleCall(fake, "set")).toEqual({
            proposal,
            subjectType: anyFunction(),
            subjectId: anyFunction(),
            leadId: anyFunction(),
            updatedAt: AT,
        })
        expect(fake.callsOf("setParameters")).toEqual([[{ subjectType: "order", subjectId: "o-1", leadId: null }]])
        expect(fake.callsOf("where")[0]).toEqual(["id = :id", { id: "item-1" }])
        const set = fake.callsOf("set")[0]?.[0] as Record<string, () => string>
        expect(set.subjectType?.()).toBe("COALESCE(CAST(:subjectType AS text), subject_type)")
    })

    it("marks an item failed", async () => {
        const { em, fake } = managerAnswering(returned([rowOf({ status: "failed" })]))

        const item = await (await build(em)).markFailed("item-1", "boom")

        expect(item.status).toBe("failed")
        expect(singleCall(fake, "set")).toEqual({ status: "failed", error: "boom", updatedAt: AT })
    })

    it("puts an item in front of a person", async () => {
        const { em, fake } = managerAnswering(returned([rowOf({ status: "waiting_decision" })]))

        await (
            await build(em)
        ).markWaiting("item-1", {
            reason: "missing_data",
            reasons: ["missing_data"],
            missing: ["need"],
            proposal,
            executionId: "exec-1",
        })

        expect(singleCall(fake, "set")).toEqual({
            status: "waiting_decision",
            reason: "missing_data",
            reasons: ["missing_data"],
            missingFields: ["need"],
            proposal,
            executionId: "exec-1",
            decidedPath: null,
            error: null,
            updatedAt: AT,
        })
    })
})

describe("WorkItemsService persistence", () => {
    it("closes an item as done, recording the routine reason only on the automatic path", async () => {
        const { em, fake } = managerAnswering(returned([rowOf({ status: "done" })]))

        await (
            await build(em)
        ).markDone("item-1", {
            path: "auto",
            proposal,
            result: { summary: "Sent", href: "/q/1" },
            evidence: "captured",
            leadId: "lead-9",
        })

        expect(singleCall(fake, "set")).toEqual({
            status: "done",
            decidedPath: "auto",
            proposal,
            result: { summary: "Sent", href: "/q/1" },
            evidenceState: "captured",
            completedAt: AT,
            updatedAt: AT,
            error: null,
            leadId: anyFunction(),
            reason: anyFunction(),
            reasons: anyFunction(),
            missingFields: [],
        })
        expect(fake.callsOf("setParameters")).toEqual([[{ path: "auto", leadId: "lead-9" }]])
        const set = fake.callsOf("set")[0]?.[0] as Record<string, () => string>
        expect(set.reason?.()).toBe("CASE WHEN CAST(:path AS text) = 'auto' THEN 'routine' ELSE reason END")
        expect(set.reasons?.()).toBe("CASE WHEN CAST(:path AS text) = 'auto' THEN ARRAY['routine'] ELSE reasons END")
    })

    it("closes an item as rejected", async () => {
        const { em, fake } = managerAnswering(returned([rowOf({ status: "rejected" })]))

        await (await build(em)).markRejected("item-1", proposal, { summary: "No" })

        expect(singleCall(fake, "set")).toEqual({
            status: "rejected",
            decidedPath: "human",
            proposal,
            completedAt: AT,
            updatedAt: AT,
            result: { summary: "No" },
        })
    })

    it("is a typed not-found when the write answers no row", async () => {
        const service = await build(managerAnswering(returned([])).em)

        await expect(service.markFailed("item-1", "boom")).rejects.toThrow(WorkItemsErrorCode.NotFound)
    })

    it("puts an item back to waiting when data is still missing", async () => {
        const { em, fake } = managerAnswering(returned([]))

        await (
            await build(em)
        ).markStillWaiting("item-1", {
            proposal,
            missing: ["need"],
            reason: "missing_data",
            reasons: ["missing_data"],
        })

        expect(singleCall(fake, "set")).toEqual({
            status: "waiting_decision",
            proposal,
            missingFields: ["need"],
            reason: "missing_data",
            reasons: ["missing_data"],
            updatedAt: AT,
        })
    })
})
