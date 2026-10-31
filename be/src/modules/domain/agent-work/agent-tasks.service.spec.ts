import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { agentTaskRowOf } from "@tests/fixtures/builders/agent-work.builder"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentTasksService } from "./agent-tasks.service"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentTaskEntity } from "./persistence/entities"

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
                goalId: null,
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
            { op: "wait", key: "approval", waitingOn: "approval", goalId: "goal-1", workItemId: "item-1" },
            { op: "wait", key: "unnamed" },
        ])

        expect(em.upsert.mock.calls.map(([, values]) => values)).toEqual([
            expect.objectContaining({
                status: "waiting",
                waitingOn: "approval",
                nextActionAt: null,
                goalId: "goal-1",
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

        expect(tx.update).toHaveBeenCalledWith(AgentTaskEntity, { id: "task-1", nextActionAt: AT(-3) }, { nextActionAt: null })
    })
})
