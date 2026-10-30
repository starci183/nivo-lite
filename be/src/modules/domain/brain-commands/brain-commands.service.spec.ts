import { Test } from "@nestjs/testing"
import { fakeTransaction, mock, mockEntityManager, recordingQueueOutbox } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { WorkspaceMembersService } from "@modules/domain/workspace-members"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { QUEUE_OUTBOX } from "@modules/platform/queue"
import { KNOWLEDGE_QUEUE } from "@modules/queues/knowledge"
import { entityRowBuilder } from "@tests/fixtures/builders/entity-row.builder"
import { evaluatedCalls, evaluatedValues } from "@tests/fixtures/builders/evaluated-calls.builder"
import { queueQueryBuilders } from "@tests/fixtures/builders/entity-query-builder.builder"
import { BrainCommandsService } from "./brain-commands.service"
import { BrainCommandEntity } from "./persistence/entities"

const rowOf = entityRowBuilder<BrainCommandEntity>({
    id: "cmd-1",
    workspaceId: "ws-1",
    requestedBy: "user-1",
    kind: "reindex",
    payload: {},
    status: "queued",
    result: null,
    errorCode: null,
    createdAt: new Date("2026-10-13T02:00:00.000Z"),
    finishedAt: null,
    updatedAt: new Date("2026-10-13T02:00:00.000Z"),
})

const build = async (entityManager: MockEntityManager) => {
    const tx = fakeTransaction(entityManager)
    const primary = mockEntityManager()
    primary.findOne.mockImplementation(entityManager.findOne)
    primary.update.mockImplementation(entityManager.update)
    primary.createQueryBuilder.mockImplementation(entityManager.createQueryBuilder)
    primary.transaction.mockImplementation(tx.em.transaction)
    const members = mock<WorkspaceMembersService>()
    const outbox = recordingQueueOutbox()
    const moduleRef = await Test.createTestingModule({
        providers: [
            BrainCommandsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: primary },
            { provide: WorkspaceMembersService, useValue: members },
            { provide: QUEUE_OUTBOX, useValue: outbox },
        ],
    }).compile()
    return { commands: moduleRef.get(BrainCommandsService), tx, primary, members, outbox }
}

describe("BrainCommandsService request", () => {
    it("writes the command and its job in one transaction and answers its id", async () => {
        const { commands, tx, primary, members, outbox } = await build(
            mockEntityManager({ insert: [BrainCommandEntity, { identifiers: [{ id: "cmd-1" }] }] }),
        )

        await expect(commands.request("user-1", "ws-1", "reindex", { source: "s-1" })).resolves.toBe("cmd-1")

        expect(members.require).toHaveBeenCalledWith("user-1", "ws-1")
        expect(evaluatedCalls(tx.em.insert.mock.calls)).toEqual([
            [
                "BrainCommandEntity",
                { workspaceId: "ws-1", requestedBy: "user-1", kind: "reindex", payload: { source: "s-1" } },
            ],
        ])
        expect(primary.insert).not.toHaveBeenCalled()
        expect(tx.outcomes).toEqual(["commit"])
        expect(outbox.jobsOf(KNOWLEDGE_QUEUE)).toEqual([
            { queue: KNOWLEDGE_QUEUE, payload: { commandId: "cmd-1", workspaceId: "ws-1" } },
        ])
        expect(outbox.allInTransaction).toBe(true)
    })

    it("writes nothing for someone who is not a member", async () => {
        const { commands, tx, members, outbox } = await build(mockEntityManager())
        const refusal = new Error("not a member")
        members.require.mockRejectedValue(refusal)

        await expect(commands.request("user-1", "ws-1", "reindex", {})).rejects.toBe(refusal)
        expect(tx.outcomes).toEqual([])
        expect(outbox.jobs).toEqual([])
    })
})
describe("BrainCommandsService stateOf", () => {
    it("answers how the command of the person stands, or nothing for a command they did not ask", async () => {
        const em = mockEntityManager({
            findOne: [
                [BrainCommandEntity, rowOf({ status: "failed", result: null, errorCode: "BRAIN_FAILED" })],
                [BrainCommandEntity, null],
            ],
        })
        const { commands } = await build(em)

        await expect(commands.stateOf("user-1", "ws-1", "cmd-1")).resolves.toEqual({
            status: "failed",
            result: null,
            errorCode: "BRAIN_FAILED",
        })
        await expect(commands.stateOf("user-2", "ws-1", "cmd-1")).resolves.toBeNull()
        expect(em.findOne).toHaveBeenCalledWith(BrainCommandEntity, {
            select: { status: true, result: true, errorCode: true },
            where: { workspaceId: "ws-1", id: "cmd-1", requestedBy: "user-2" },
        })
    })
})
describe("BrainCommandsService get", () => {
    it("answers the command, or nothing when it is not there", async () => {
        const em = mockEntityManager({
            findOne: [
                [BrainCommandEntity, rowOf({ payload: { source: "s-1" } })],
                [BrainCommandEntity, null],
            ],
        })
        const { commands } = await build(em)

        await expect(commands.get("ws-1", "cmd-1")).resolves.toEqual({
            id: "cmd-1",
            workspaceId: "ws-1",
            requestedBy: "user-1",
            kind: "reindex",
            payload: { source: "s-1" },
            status: "queued",
        })
        await expect(commands.get("ws-1", "cmd-9")).resolves.toBeNull()
    })
})
describe("BrainCommandsService begin, finish and fail", () => {
    it("takes an open command and refuses a closed one", async () => {
        const em = mockEntityManager({
            update: [
                [BrainCommandEntity, { affected: 1 }],
                [BrainCommandEntity, { affected: 0 }],
            ],
        })
        const { commands } = await build(em)

        await expect(commands.begin("ws-1", "cmd-1")).resolves.toBe(true)
        await expect(commands.begin("ws-1", "cmd-1")).resolves.toBe(false)
    })

    it("refuses a command when the database does not say how many rows changed", async () => {
        const { commands } = await build(mockEntityManager({ update: [BrainCommandEntity, {}] }))

        await expect(commands.begin("ws-1", "cmd-1")).resolves.toBe(false)
    })

    it("closes a command with its result, the jsonb null when it has none, or its stored code", async () => {
        const em = mockEntityManager({ update: [BrainCommandEntity, { affected: 1 }] })
        const [withResult, withNone] = queueQueryBuilders(em, [{ execute: {} }, { execute: {} }])
        const { commands } = await build(em)

        await commands.finish("ws-1", "cmd-1", { facts: 3 })
        await commands.finish("ws-1", "cmd-3", null)
        await commands.fail("ws-1", "cmd-2", "BRAIN_FAILED")

        expect(em.createQueryBuilder).toHaveBeenCalledWith(BrainCommandEntity, "bc")
        expect(withResult?.callsOf("where")).toEqual([[{ workspaceId: "ws-1", id: "cmd-1" }]])
        expect(withResult?.callsOf("setParameter")).toEqual([["result", '{"facts":3}']])
        expect(withNone?.callsOf("setParameter")).toEqual([["result", "null"]])
        expect(evaluatedValues(withResult?.callsOf("set")[0]?.[0])).toEqual({
            status: "done",
            result: ":result::jsonb",
            errorCode: null,
            payload: "payload - 'token'",
            finishedAt: "now()",
        })
        expect(evaluatedCalls(em.update.mock.calls, 2)).toEqual([
            [
                "BrainCommandEntity",
                { workspaceId: "ws-1", id: "cmd-2" },
                {
                    status: "failed",
                    result: null,
                    errorCode: "BRAIN_FAILED",
                    payload: "payload - 'token'",
                    finishedAt: "now()",
                },
            ],
        ])
    })
})
