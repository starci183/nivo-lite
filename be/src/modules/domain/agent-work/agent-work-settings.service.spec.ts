import { Test } from "@nestjs/testing"
import { fakeTransaction, FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In, IsNull } from "typeorm"
import {
    agentWorkSettingsRowOf,
    agentWorkStateRowOf,
    heldCustomerWakeRowOf,
    heldOldWakeRowOf,
    heldScheduleWakeRowOf,
    heldTaskWakeRowOf,
    heldTagWakeRowOf,
} from "@tests/fixtures/builders/agent-work.builder"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AGENT_TURN_QUEUE_PRODUCER } from "@modules/queues/agent-turn"
import type { AgentTurnQueue } from "@modules/queues/agent-turn"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { AgentWorkSettingsService } from "./agent-work-settings.service"
import { AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentTaskEntity, AgentWakeEntity, AgentWorkSettingsEntity, AgentWorkStateEntity } from "./persistence/entities"

const NOW = "2026-11-10T03:00:00.000Z"
const SWITCH = 'SELECT * FROM "public"."agent_work_switch"($1, $2, $3, $4)'

const build = async (base: MockEntityManager = mockEntityManager()) => {
    const tx = fakeTransaction(base)
    const access = mock<AgentWorkAccessService>({ owner: jest.fn().mockResolvedValue("seat-1") })
    const queue = mock<AgentTurnQueue>({ enqueueSweepDrain: jest.fn().mockResolvedValue(undefined) })
    const container = await Test.createTestingModule({
        providers: [
            AgentWorkSettingsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: base },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AGENT_TURN_QUEUE_PRODUCER, useValue: queue },
            { provide: AgentWorkAccessService, useValue: access },
        ],
    }).compile()
    return { service: container.get(AgentWorkSettingsService), em: base, tx, access, queue }
}

describe("AgentWorkSettingsService reads", () => {
    it("answers the settings of a workspace, or the defaults while it has no row", async () => {
        const known = await build(mockEntityManager({ findOne: [AgentWorkSettingsEntity, agentWorkSettingsRowOf()] }))
        const unknown = await build(mockEntityManager({ findOne: [AgentWorkSettingsEntity, null] }))

        await expect(known.service.settingsOf("ws-1")).resolves.toEqual({
            workspaceId: "ws-1",
            workEnabled: true,
            road: "core",
            backgroundDailyCap: 50,
        })
        await expect(unknown.service.settingsOf("ws-1")).resolves.toMatchObject({ road: "core", workEnabled: true })
        await expect(known.service.roadOf("ws-1")).resolves.toBe("core")
        await expect(unknown.service.roadOf("ws-1")).resolves.toBe("core")
    })

    it("answers the state of an agent, or the defaults while it has no row", async () => {
        const known = await build(mockEntityManager({ findOne: [AgentWorkStateEntity, agentWorkStateRowOf()] }))
        const unknown = await build(mockEntityManager({ findOne: [AgentWorkStateEntity, null] }))

        await expect(known.service.stateOf("agent-1")).resolves.toMatchObject({ failures: 2, backgroundTurns: 4 })
        await expect(unknown.service.stateOf("agent-1")).resolves.toMatchObject({ failures: 0, workEnabled: true })
    })
})

describe("AgentWorkSettingsService.setWorkspaceWork", () => {
    it("refuses a caller who is not an owner, and writes nothing", async () => {
        const { service, access, em } = await build()
        access.owner.mockRejectedValueOnce(new Error("owner only"))

        await expect(service.setWorkspaceWork("user-2", "ws-1", false)).rejects.toThrow("owner only")
        expect(em.transaction).not.toHaveBeenCalled()
    })

    it("switches work off, noting who and when, and holds nothing back", async () => {
        const { service, tx, em } = await build(
            mockEntityManager({
                upsert: [AgentWorkSettingsEntity, {}],
                findOne: [AgentWorkSettingsEntity, agentWorkSettingsRowOf({ workEnabled: false })],
            }),
        )

        await expect(service.setWorkspaceWork("user-1", "ws-1", false)).resolves.toMatchObject({ workEnabled: false })

        expect(em.upsert).toHaveBeenCalledWith(
            AgentWorkSettingsEntity,
            { workspaceId: "ws-1", workEnabled: false, pausedBy: "seat-1", pausedAt: new Date(NOW) },
            ["workspaceId"],
        )
        expect(tx.commits).toBe(1)
    })

    it("switches work on, clears who paused it and returns the wakes it held", async () => {
        const recent = heldCustomerWakeRowOf("w-customer")
        const tag = heldTagWakeRowOf("w-tag")
        const old = heldOldWakeRowOf("w-old")
        const background = heldScheduleWakeRowOf("w-sched")
        const { service, em, queue } = await build(
            mockEntityManager({
                upsert: [AgentWorkSettingsEntity, {}],
                update: [AgentWakeEntity, { affected: 1 }],
                findOne: [AgentWorkSettingsEntity, agentWorkSettingsRowOf()],
            }),
        )
        em.find.mockResolvedValueOnce([recent, tag, old, background]).mockResolvedValueOnce([])

        await service.setWorkspaceWork("user-1", "ws-1", true)

        expect(em.upsert).toHaveBeenCalledWith(
            AgentWorkSettingsEntity,
            { workspaceId: "ws-1", workEnabled: true, pausedBy: null, pausedAt: null },
            ["workspaceId"],
        )
        expect(em.find).toHaveBeenNthCalledWith(1, AgentWakeEntity, {
            where: { workspaceId: "ws-1", status: "held", reason: "killed" },
            order: { createdAt: "ASC" },
            take: 500,
        })
        expect(em.update).toHaveBeenCalledWith(
            AgentWakeEntity,
            { id: In(["w-customer", "w-tag"]) },
            { status: "pending", reason: null },
        )
        expect(em.update).toHaveBeenCalledWith(
            AgentWakeEntity,
            { id: In(["w-old", "w-sched"]) },
            { status: "skipped", reason: "stale", finishedAt: new Date(NOW) },
        )
        expect(queue.enqueueSweepDrain.mock.calls.map(([scope]) => scope)).toEqual([
            { workspaceId: "ws-1", agentId: "agent-1", scopeKey: "conversation:conv-1" },
            { workspaceId: "ws-1", agentId: "agent-2", scopeKey: "agent" },
        ])
    })
})

describe("AgentWorkSettingsService.setWorkspaceWork, a task whose wake was held", () => {
    it("makes the task due again when its wake goes stale, so a held wake is not the end of the task", async () => {
        const { service, em } = await build(
            mockEntityManager({
                upsert: [AgentWorkSettingsEntity, {}],
                update: [
                    [AgentWakeEntity, { affected: 1 }],
                    [AgentTaskEntity, { affected: 1 }],
                ],
                findOne: [AgentWorkSettingsEntity, agentWorkSettingsRowOf()],
            }),
        )
        em.find.mockResolvedValueOnce([heldTaskWakeRowOf("w-task")]).mockResolvedValueOnce([])

        await service.setWorkspaceWork("user-1", "ws-1", true)

        expect(em.update).toHaveBeenCalledWith(
            AgentTaskEntity,
            { id: In(["task-1"]), status: "open", nextActionAt: IsNull() },
            { nextActionAt: new Date(NOW) },
        )
    })
})

describe("AgentWorkSettingsService.setAgentWork", () => {
    it("refuses a caller who is not an owner", async () => {
        const { service, access } = await build()
        access.owner.mockRejectedValueOnce(new Error("owner only"))

        await expect(service.setAgentWork("user-2", "ws-1", "agent-1", false)).rejects.toThrow("owner only")
    })

    it("refuses an agent the database does not find in the workspace, and rolls back", async () => {
        const { service, tx } = await build(mockEntityManager({ query: [SWITCH, [{ agent_work_switch: false }]] }))

        await expect(service.setAgentWork("user-1", "ws-1", "agent-9", false)).rejects.toMatchObject({
            code: AgentWorkErrorCode.AgentNotFound,
        })
        expect(tx.rollbacks).toBe(1)
    })

    it("switches one agent off and answers its state", async () => {
        const { service, em } = await build(
            mockEntityManager({
                query: [SWITCH, [{ agent_work_switch: true }]],
                findOne: [AgentWorkStateEntity, agentWorkStateRowOf({ workEnabled: false })],
            }),
        )

        await expect(service.setAgentWork("user-1", "ws-1", "agent-1", false)).resolves.toMatchObject({
            workEnabled: false,
        })
        expect(em.query).toHaveBeenCalledWith(SWITCH, ["ws-1", "agent-1", false, "seat-1"])
        expect(em.find).not.toHaveBeenCalled()
    })

    it("switches one agent on and returns only its own held wakes to the queue", async () => {
        const wake = heldCustomerWakeRowOf("w-1")
        const { service, em, queue } = await build(
            mockEntityManager({
                query: [SWITCH, [{ agent_work_switch: true }]],
                update: [AgentWakeEntity, { affected: 1 }],
                findOne: [AgentWorkStateEntity, agentWorkStateRowOf()],
            }),
        )
        em.find.mockResolvedValueOnce([wake]).mockResolvedValueOnce([])

        await service.setAgentWork("user-1", "ws-1", "agent-1", true)

        expect(em.find).toHaveBeenNthCalledWith(1, AgentWakeEntity, {
            where: { agentId: "agent-1", status: "held", reason: "killed" },
            order: { createdAt: "ASC" },
            take: 500,
        })
        expect(em.update).toHaveBeenCalledWith(
            AgentWakeEntity,
            { id: In(["w-1"]) },
            { status: "pending", reason: null },
        )
        expect(queue.enqueueSweepDrain).toHaveBeenCalledTimes(1)
    })

    it("stops after twenty passes when a backlog never ends", async () => {
        const { service, em } = await build(
            mockEntityManager({
                query: [SWITCH, [{ agent_work_switch: true }]],
                update: [AgentWakeEntity, { affected: 1 }],
                findOne: [AgentWorkStateEntity, agentWorkStateRowOf()],
                find: [AgentWakeEntity, [heldScheduleWakeRowOf("w-1")]],
            }),
        )

        await service.setAgentWork("user-1", "ws-1", "agent-1", true)

        expect(em.find).toHaveBeenCalledTimes(20)
    })
})
