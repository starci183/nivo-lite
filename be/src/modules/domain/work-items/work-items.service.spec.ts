import { WorkItemsErrorCode } from "./errors/work-items.error"
import { FakeClock, fakeIds, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { Test } from "@nestjs/testing"
import { In } from "typeorm"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { IDS } from "@modules/platform/ids"
import {
    AT,
    NOW,
    MINTED,
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
import { AUTO_DONE_COLUMNS } from "@tests/fixtures/builders/work-items-service.builder"
import { evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { WorkItemEntity } from "./persistence/entities"
import { WorkItemsService } from "./work-items.service"

const build = async (entityManager: MockEntityManager) =>
    (
        await Test.createTestingModule({
            providers: [
                WorkItemsService,
                { provide: PRIMARY_ENTITY_MANAGER, useValue: entityManager },
                { provide: CLOCK, useValue: new FakeClock(NOW) },
                { provide: IDS, useValue: fakeIds() },
            ],
        }).compile()
    ).get(WorkItemsService)

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

    it("answers nothing when the dedupe key is used", async () => {
        const service = await build(managerAnswering(returned([])).em)

        expect(await service.insert(newItem)).toBeNull()
    })

    it("makes a root item the root of its own chain, and inserts and reads the durable item through the caller's transaction", async () => {
        const primary = mockEntityManager()
        const { em: tx, fake } = managerAnswering(
            returned([rowOf()]),
            mockEntityManager({ findOne: [WorkItemEntity, entityOf()] }),
        )
        const service = await build(primary)

        expect((await service.insert(newItem, tx))?.id).toBe("item-1")
        expect(fake.callsOf("values")[0]?.[0]).toMatchObject({ id: MINTED, chainId: MINTED })
        expect((await service.findByDedupe("ws-1", "send_quote:lead-1", tx))?.id).toBe("item-1")

        expect(primary.createQueryBuilder).not.toHaveBeenCalled()
        expect(primary.findOne).not.toHaveBeenCalled()
        expect(tx.findOne).toHaveBeenCalledWith(WorkItemEntity, {
            where: { workspaceId: "ws-1", dedupeKey: "send_quote:lead-1" },
        })
    })
})

describe("WorkItemsService listing", () => {
    it("answers the items of the given ids", async () => {
        const em = mockEntityManager({ find: [WorkItemEntity, [entityOf()]] })

        expect(await (await build(em)).findMany(["item-1", "item-2"], 200)).toEqual([contractOf()])
        expect(em.find).toHaveBeenCalledWith(WorkItemEntity, { where: { id: In(["item-1", "item-2"]) }, take: 200 })
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

    it("finds the item of a dedupe key", async () => {
        const em = mockEntityManager({ findOne: [WorkItemEntity, entityOf()] })

        expect((await (await build(em)).findByDedupe("ws-1", "k"))?.id).toBe("item-1")
        expect(em.findOne).toHaveBeenCalledWith(WorkItemEntity, { where: { workspaceId: "ws-1", dedupeKey: "k" } })
    })

    it("answers nothing for a dedupe key nobody used", async () => {
        const em = mockEntityManager({ findOne: [WorkItemEntity, null] })

        expect(await (await build(em)).findByDedupe("ws-1", "k")).toBeNull()
    })
})

describe("WorkItemsService persistence", () => {
    it("reopens an item that waits, and answers nothing for any other", async () => {
        const waiting = managerAnswering(returned([rowOf()]))
        const other = managerAnswering(returned([]))

        expect((await (await build(waiting.em)).reopen("ws-1", "item-1"))?.id).toBe("item-1")
        expect(singleCall(waiting.fake, "set")).toEqual({ status: "queued", leasedAt: AT })
        expect(waiting.fake.callsOf("where")[0]?.[0]).toBe(
            "workspace_id = :workspaceId AND id = :id AND status = 'waiting_decision'",
        )
        expect(await (await build(other.em)).reopen("ws-1", "item-1")).toBeNull()
    })
})

describe("WorkItemsService persistence", () => {
    it("marks an item failed", async () => {
        const { em, fake } = managerAnswering(returned([rowOf({ status: "failed" })]))

        const item = await (await build(em)).markFailed("item-1", "boom")

        expect(item.status).toBe("failed")
        expect(singleCall(fake, "set")).toEqual({ status: "failed", error: "boom", leasedAt: AT })
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
            leasedAt: AT,
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

        expect(evaluatedValues(singleCall(fake, "set"))).toEqual(AUTO_DONE_COLUMNS)
        expect(fake.callsOf("setParameters")).toEqual([[{ path: "auto", leadId: "lead-9" }]])
    })

    it("closes an item as rejected", async () => {
        const { em, fake } = managerAnswering(returned([rowOf({ status: "rejected" })]))

        await (await build(em)).markRejected("item-1", proposal, { summary: "No" })

        expect(singleCall(fake, "set")).toEqual({
            status: "rejected",
            decidedPath: "human",
            proposal,
            completedAt: AT,
            leasedAt: AT,
            result: { summary: "No" },
        })
    })

    it("is a typed not-found when the write answers no row", async () => {
        const service = await build(managerAnswering(returned([])).em)

        await expect(service.markFailed("item-1", "boom")).rejects.toThrow(WorkItemsErrorCode.NotFound)
    })
})

/** The row of the workspace that names this installation, or none. */
const rowNaming = (installationId: string | null) => Object.assign(new WorkItemEntity(), { installationId })

describe("WorkItemsService installationIdOf", () => {
    it("answers the installation a row of the workspace names", async () => {
        const em = mockEntityManager({ findOne: [WorkItemEntity, rowNaming("inst-1")] })

        await expect((await build(em)).installationIdOf("ws-1", "rec-1")).resolves.toBe("inst-1")
        expect(em.findOne).toHaveBeenCalledWith(WorkItemEntity, {
            select: { installationId: true },
            where: { workspaceId: "ws-1", id: "rec-1" },
        })
    })

    it("answers null for a missing row and for a row that names no installation", async () => {
        const em = mockEntityManager({ findOne: [WorkItemEntity, null] })
        await expect((await build(em)).installationIdOf("ws-1", "rec-1")).resolves.toBeNull()

        await expect(
            (await build(mockEntityManager({ findOne: [WorkItemEntity, rowNaming(null)] }))).installationIdOf(
                "ws-1",
                "rec-1",
            ),
        ).resolves.toBeNull()
    })
})
