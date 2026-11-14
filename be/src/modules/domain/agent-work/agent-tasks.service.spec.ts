import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, IsNull, Not } from "typeorm"
import { agentTaskRowOf } from "@tests/fixtures/builders/agent-work.builder"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentTasksService } from "./agent-tasks.service"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentTaskEntity } from "./persistence/entities"


/** A query builder that records its update: the table, the values set, the where text and its params; it answers `affected`. */
const updateBuilderOf = (affected: number) => {
    const seen: { entity?: unknown; set?: Record<string, unknown>; where?: string; params?: Record<string, unknown> } = {}
    const builder = {
        update: (entity: unknown) => ((seen.entity = entity), builder),
        set: (values: Record<string, unknown>) => ((seen.set = values), builder),
        where: (text: string, params: Record<string, unknown>) => ((seen.where = text), (seen.params = params), builder),
        execute: () => Promise.resolve({ affected, raw: [], generatedMaps: [] }),
    }
    return { builder, seen }
}

const NOW = "2026-11-10T03:00:00.000Z"
const AT = (minutes: number): Date => new Date(new Date(NOW).getTime() + minutes * 60_000)

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const access = mock<AgentWorkAccessService>({ manager: jest.fn().mockResolvedValue("seat-1") })
    const container = await Test.createTestingModule({
        providers: [
            AgentTasksService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AgentWorkAccessService, useValue: access },
        ],
    }).compile()
    return { service: container.get(AgentTasksService), em, access }
}

describe("AgentTasksService.alive", () => {
    it("lists the open and waiting tasks of the agent, the next to wake first", async () => {
        const { service, em } = await build(
            mockEntityManager({
                find: [
                    AgentTaskEntity,
                    [
                        agentTaskRowOf(),
                        agentTaskRowOf({ id: "task-2", status: "waiting", waitingOn: "member", nextActionAt: null }),
                    ],
                ],
            }),
        )

        const tasks = await service.alive("agent-1")

        expect(tasks.map((task) => [task.id, task.status, task.waitingOn])).toEqual([
            ["task-1", "open", null],
            ["task-2", "waiting", "member"],
        ])
        expect(em.find).toHaveBeenCalledWith(AgentTaskEntity, {
            where: { agentId: "agent-1", status: In(["open", "waiting"]) },
            order: { nextActionAt: { direction: "ASC", nulls: "LAST" }, createdAt: "ASC" },
            take: 100,
        })
    })
})

describe("AgentTasksService.byId", () => {
    it("answers the task with its key and title, or null when there is none", async () => {
        const { service, em } = await build(
            mockEntityManager({ findOne: [AgentTaskEntity, agentTaskRowOf({ dedupeKey: "care:payment-reminder:o1" })] }),
        )

        await expect(service.byId("task-1")).resolves.toMatchObject({ id: "task-1", dedupeKey: "care:payment-reminder:o1" })
        expect(em.findOne).toHaveBeenCalledWith(AgentTaskEntity, { where: { id: "task-1" } })

        const none = await build(mockEntityManager({ findOne: [AgentTaskEntity, null] }))
        await expect(none.service.byId("ghost")).resolves.toBeNull()
    })
})

describe("AgentTasksService.apply, opening a task", () => {
    it("opens a task under its key, so the same proposal applied twice is one task", async () => {
        const { service, em } = await build(mockEntityManager({ upsert: [AgentTaskEntity, {}] }))
        const op = {
            op: "add",
            key: "chase-invoice",
            title: "Chase invoice 12",
            nextActionAt: AT(60),
            originWakeId: "wake-1",
        } as const

        await service.apply("ws-1", "agent-1", [op])
        await service.apply("ws-1", "agent-1", [op])

        expect(em.upsert).toHaveBeenCalledTimes(2)
        expect(em.upsert).toHaveBeenNthCalledWith(
            1,
            AgentTaskEntity,
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                dedupeKey: "chase-invoice",
                title: "Chase invoice 12",
                status: "open",
                waitingOn: null,
                nextActionAt: AT(60),
                originWakeId: "wake-1",
                workItemId: null,
                doneAt: null,
            },
            ["agentId", "dedupeKey"],
        )
        expect(em.upsert.mock.calls[1]).toEqual(em.upsert.mock.calls[0])
    })

    it("names a task by its key when the proposal gave no title, and cuts a long title", async () => {
        const { service, em } = await build(mockEntityManager({ upsert: [AgentTaskEntity, {}] }))

        await service.apply("ws-1", "agent-1", [
            { op: "add", key: "by-key" },
            { op: "add", key: "long", title: "x".repeat(300) },
        ])

        expect(em.upsert.mock.calls.map(([, values]) => values)).toEqual([
            expect.objectContaining({ title: "by-key" }),
            expect.objectContaining({ title: "x".repeat(200) }),
        ])
    })

    it("keeps a wake time the agent asked for between five minutes and seven days", async () => {
        const { service, em } = await build(mockEntityManager({ upsert: [AgentTaskEntity, {}] }))

        await service.apply("ws-1", "agent-1", [
            { op: "add", key: "soon", nextActionAt: AT(1) },
            { op: "add", key: "later", nextActionAt: AT(60 * 24 * 30) },
        ])

        expect(em.upsert.mock.calls.map(([, values]) => values)).toEqual([
            expect.objectContaining({ nextActionAt: AT(5) }),
            expect.objectContaining({ nextActionAt: AT(60 * 24 * 7) }),
        ])
    })
})

describe("AgentTasksService.apply, parking and closing a task", () => {
    it("parks a task on what it waits for, and on an event when it says nothing", async () => {
        const { service, em } = await build(mockEntityManager({ upsert: [AgentTaskEntity, {}] }))

        await service.apply("ws-1", "agent-1", [
            { op: "wait", key: "approval", waitingOn: "approval", workItemId: "item-1" },
            { op: "wait", key: "unnamed" },
        ])

        expect(em.upsert.mock.calls.map(([, values]) => values)).toEqual([
            expect.objectContaining({
                status: "waiting",
                waitingOn: "approval",
                nextActionAt: null,
                workItemId: "item-1",
            }),
            expect.objectContaining({ status: "waiting", waitingOn: "event" }),
        ])
    })

    it("lets a task sleep until a time instead of waiting for a thing", async () => {
        const { service, em } = await build(mockEntityManager({ upsert: [AgentTaskEntity, {}] }))

        await service.apply("ws-1", "agent-1", [{ op: "wait", key: "sleep", nextActionAt: AT(120) }])

        expect(em.upsert.mock.calls[0]?.[1]).toEqual(
            expect.objectContaining({ status: "open", waitingOn: null, nextActionAt: AT(120) }),
        )
    })

    it("closes an open or waiting task by its key and clears what it waited for", async () => {
        const { service, em } = await build(mockEntityManager({ update: [AgentTaskEntity, { affected: 1 }] }))

        await service.apply("ws-1", "agent-1", [{ op: "done", key: "chase-invoice" }])

        expect(em.update).toHaveBeenCalledWith(
            AgentTaskEntity,
            { agentId: "agent-1", dedupeKey: "chase-invoice", status: In(["open", "waiting"]) },
            { status: "done", doneAt: new Date(NOW), nextActionAt: null, waitingOn: null },
        )
        expect(em.upsert).not.toHaveBeenCalled()
    })

    it("applies the operations in the order the proposal gave them", async () => {
        const { service, em } = await build(
            mockEntityManager({
                upsert: [AgentTaskEntity, {}],
                update: [AgentTaskEntity, { affected: 1 }],
            }),
        )

        await service.apply("ws-1", "agent-1", [
            { op: "add", key: "a" },
            { op: "done", key: "a" },
        ])

        expect(em.upsert.mock.invocationCallOrder[0]).toBeLessThan(em.update.mock.invocationCallOrder[0] ?? 0)
    })
})

describe("AgentTasksService.drop", () => {
    it("drops a live task of the agent for an owner or manager", async () => {
        const { service, em, access } = await build(mockEntityManager({ update: [AgentTaskEntity, { affected: 1 }] }))

        await service.drop("user-1", "ws-1", "agent-1", "task-1")

        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(em.update).toHaveBeenCalledWith(
            AgentTaskEntity,
            { id: "task-1", agentId: "agent-1", workspaceId: "ws-1", status: In(["open", "waiting"]) },
            { status: "dropped", doneAt: new Date(NOW), nextActionAt: null, waitingOn: null },
        )
    })

    it("refuses a task that is not the agent's or is already closed", async () => {
        const { service } = await build(mockEntityManager({ update: [AgentTaskEntity, { affected: 0 }] }))

        await expect(service.drop("user-1", "ws-1", "agent-1", "task-9")).rejects.toMatchObject({
            code: AgentWorkErrorCode.TaskNotFound,
        })
    })

    it("refuses staff before touching the task", async () => {
        const { service, em, access } = await build()
        access.manager.mockRejectedValueOnce(new Error("staff"))

        await expect(service.drop("user-3", "ws-1", "agent-1", "task-1")).rejects.toThrow("staff")
        expect(em.update).not.toHaveBeenCalled()
    })
})

describe("AgentTasksService.markWoken", () => {
    it("clears the wake time only while it is still the one that was woken for", async () => {
        const { service } = await build()
        const tx = mockEntityManager({ update: [AgentTaskEntity, { affected: 1 }] })

        await service.markWoken(tx, "task-1", AT(-3))

        expect(tx.update).toHaveBeenCalledWith(
            AgentTaskEntity,
            { id: "task-1", nextActionAt: AT(-3) },
            { nextActionAt: null },
        )
    })
})

describe("AgentTasksService, the generic timer's task", () => {
    it("arms a timer as one open task under its key, the wake time NOT bounded to five minutes, the data kept (null clears it)", async () => {
        const { service, em } = await build(mockEntityManager({ upsert: [AgentTaskEntity, {}] }))
        const wakeAt = AT(1)

        await service.armTimer("ws-1", "agent-1", { key: "timer:contact:c-1:r", title: "timer due x", wakeAt, data: { tries: 1 } })

        expect(em.upsert).toHaveBeenCalledWith(
            AgentTaskEntity,
            {
                workspaceId: "ws-1",
                agentId: "agent-1",
                dedupeKey: "timer:contact:c-1:r",
                title: "timer due x",
                status: "open",
                waitingOn: null,
                nextActionAt: wakeAt,
                doneAt: null,
                data: { tries: 1 },
            },
            ["agentId", "dedupeKey"],
        )
    })

    it("cancels the open, armed timer of the agent by its key and says whether there was one", async () => {
        const hit = await build(mockEntityManager({ update: [AgentTaskEntity, { affected: 1 }] }))
        await expect(hit.service.cancelTimer("agent-1", "timer:contact:c-1:r")).resolves.toBe(true)
        expect(hit.em.update).toHaveBeenCalledWith(
            AgentTaskEntity,
            { agentId: "agent-1", dedupeKey: "timer:contact:c-1:r", status: "open", nextActionAt: Not(IsNull()) },
            { status: "done", doneAt: new Date(NOW), nextActionAt: null },
        )
        const miss = await build(mockEntityManager({ update: [AgentTaskEntity, { affected: 0 }] }))
        await expect(miss.service.cancelTimer("agent-1", "timer:contact:c-1:r")).resolves.toBe(false)
    })

    it("closes a fired timer's task only when its time is still the one that woke, and moves a wake time only from the time it was read at", async () => {
        const { service, em } = await build(mockEntityManager({ update: [AgentTaskEntity, { affected: 1 }] }))
        const tx = mockEntityManager({ update: [AgentTaskEntity, { affected: 1 }] })
        const at = AT(-2)

        await service.markFired(tx, "task-1", at)
        await service.moveWake("task-1", at, AT(60))

        expect(tx.update).toHaveBeenCalledWith(
            AgentTaskEntity,
            { id: "task-1", nextActionAt: at },
            { nextActionAt: null, status: "done", doneAt: new Date(NOW) },
        )
        expect(em.update).toHaveBeenCalledWith(AgentTaskEntity, { id: "task-1", nextActionAt: at }, { nextActionAt: AT(60) })
    })
})

describe("AgentTasksService.dropOfKeyStarts (R72 Q1: erasing a person ends the timers armed for them)", () => {
    it("drops every live task of the workspace whose key starts with one of the subject starts, literally (LIKE wildcards escaped)", async () => {
        const { service } = await build()
        const { builder, seen } = updateBuilderOf(2)
        const tx = mockEntityManager()
        tx.createQueryBuilder.mockReturnValue(builder as never)

        await expect(service.dropOfKeyStarts(tx, "ws-1", ["timer:contact:c-1:", "timer:conversation:r_1%:"])).resolves.toBe(2)

        expect(seen.entity).toBe(AgentTaskEntity)
        expect(seen.set).toEqual({ status: "dropped", nextActionAt: null, doneAt: new Date(NOW) })
        expect(seen.where).toBe("workspace_id = :workspaceId AND status IN ('open', 'waiting') AND (dedupe_key LIKE :start0 OR dedupe_key LIKE :start1)")
        expect(seen.params).toEqual({ workspaceId: "ws-1", start0: "timer:contact:c-1:%", start1: "timer:conversation:r\\_1\\%:%" })
    })

    it("writes nothing for no start", async () => {
        const { service } = await build()
        const tx = mockEntityManager()

        await expect(service.dropOfKeyStarts(tx, "ws-1", [])).resolves.toBe(0)
        expect(tx.createQueryBuilder).not.toHaveBeenCalled()
    })
})
