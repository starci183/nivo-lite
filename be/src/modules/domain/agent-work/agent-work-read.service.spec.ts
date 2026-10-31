import { Test } from "@nestjs/testing"
import { mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import { agentTurnRowOf, agentWakeRowOf, runningWakeRowOf } from "@tests/fixtures/builders/agent-work.builder"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentGoalsService } from "./agent-goals.service"
import { AgentTasksService } from "./agent-tasks.service"
import { AgentTriggersService } from "./agent-triggers.service"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { AgentWorkReadService } from "./agent-work-read.service"
import { AgentWorkSettingsService } from "./agent-work-settings.service"
import { AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentTurnEntity, AgentWakeEntity, AgentWorkStateEntity } from "./persistence/entities"
import type { AgentWorkState } from "./agent-work.contracts"

const STATE: AgentWorkState = {
    agentId: "agent-1",
    workEnabled: true,
    failures: 0,
    breakerUntil: null,
    lastTurnAt: null,
    backgroundDay: null,
    backgroundTurns: 0,
}

const turnRow = (id: string, wakeId: string) => agentTurnRowOf({ id, wakeId })

const wakeRow = (id: string) =>
    agentWakeRowOf({ id, eventKey: id, source: "schedule", scopeKey: "agent", status: "skipped", reason: "no_work" })

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const access = mock<AgentWorkAccessService>({ agent: jest.fn().mockResolvedValue(undefined) })
    const settings = mock<AgentWorkSettingsService>({
        stateOf: jest.fn().mockResolvedValue(STATE),
        settingsOf: jest
            .fn()
            .mockResolvedValue({ workspaceId: "ws-1", workEnabled: true, road: "legacy", backgroundDailyCap: 200 }),
    })
    const goals = mock<AgentGoalsService>({ alive: jest.fn().mockResolvedValue([]) })
    const tasks = mock<AgentTasksService>({ alive: jest.fn().mockResolvedValue([]) })
    const triggers = mock<AgentTriggersService>({ ofAgent: jest.fn().mockResolvedValue([]) })
    const container = await Test.createTestingModule({
        providers: [
            AgentWorkReadService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: AgentWorkAccessService, useValue: access },
            { provide: AgentWorkSettingsService, useValue: settings },
            { provide: AgentGoalsService, useValue: goals },
            { provide: AgentTasksService, useValue: tasks },
            { provide: AgentTriggersService, useValue: triggers },
        ],
    }).compile()
    return { service: container.get(AgentWorkReadService), em, access }
}

describe("AgentWorkReadService.agentWork", () => {
    it("gathers the state, lists, recent turns and the count of waiting wakes of one agent", async () => {
        const { service, em, access } = await build(
            mockEntityManager({
                find: [
                    [AgentTurnEntity, [turnRow("turn-1", "wake-1")]],
                    [AgentWakeEntity, [wakeRow("wake-1")]],
                ],
                count: [AgentWakeEntity, 3],
            }),
        )

        const view = await service.agentWork("ws-1", "agent-1")

        expect(access.agent).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(view).toMatchObject({ state: STATE, goals: [], tasks: [], triggers: [], pendingWakes: 3 })
        expect(view.turns).toEqual([
            {
                id: "turn-1",
                source: "schedule",
                wakeStatus: "skipped",
                reason: "no_work",
                status: "settled",
                model: "p/m",
                promptTokens: 3,
                completionTokens: 2,
                cost: 0.01,
                durationMs: 500,
                wokeAt: new Date("2026-11-10T01:00:00.000Z"),
                workItemId: null,
            },
        ])
        expect(JSON.stringify(view)).not.toContain("private words")
        expect(em.find).toHaveBeenCalledWith(AgentTurnEntity, {
            where: { agentId: "agent-1" },
            order: { createdAt: "DESC" },
            take: 20,
        })
        expect(em.find).toHaveBeenCalledWith(AgentWakeEntity, { where: { id: In(["wake-1"]) }, take: 20 })
        expect(em.count).toHaveBeenCalledWith(AgentWakeEntity, { where: { agentId: "agent-1", status: "pending" } })
    })

    it("reads no wakes when the agent has no turns", async () => {
        const { service, em } = await build(
            mockEntityManager({
                find: [AgentTurnEntity, []],
                count: [AgentWakeEntity, 0],
            }),
        )

        const view = await service.agentWork("ws-1", "agent-1")

        expect(view.turns).toEqual([])
        expect(em.find).toHaveBeenCalledTimes(1)
    })

    it("leaves out a turn whose wake is gone", async () => {
        const { service } = await build(
            mockEntityManager({
                find: [
                    [AgentTurnEntity, [turnRow("turn-1", "wake-1"), turnRow("turn-2", "wake-2")]],
                    [AgentWakeEntity, [wakeRow("wake-2")]],
                ],
                count: [AgentWakeEntity, 0],
            }),
        )

        const view = await service.agentWork("ws-1", "agent-1")

        expect(view.turns.map((turn) => turn.id)).toEqual(["turn-2"])
    })

    it("refuses an agent of another workspace", async () => {
        const { service, access } = await build()
        access.agent.mockRejectedValueOnce({ code: AgentWorkErrorCode.AgentNotFound })

        await expect(service.agentWork("ws-1", "agent-9")).rejects.toEqual({ code: AgentWorkErrorCode.AgentNotFound })
    })
})

describe("AgentWorkReadService.workspaceWork", () => {
    it("counts the agents that are off and the wakes waiting or held", async () => {
        const { service, em } = await build(
            mockEntityManager({
                count: [
                    [AgentWorkStateEntity, 2],
                    [AgentWakeEntity, 9],
                ],
            }),
        )

        await expect(service.workspaceWork("ws-1")).resolves.toEqual({
            settings: { workspaceId: "ws-1", workEnabled: true, road: "legacy", backgroundDailyCap: 200 },
            agentsOff: 2,
            pendingWakes: 9,
            heldWakes: 9,
        })
        expect(em.count).toHaveBeenCalledWith(AgentWorkStateEntity, {
            where: { workspaceId: "ws-1", workEnabled: false },
        })
        expect(em.count).toHaveBeenCalledWith(AgentWakeEntity, { where: { workspaceId: "ws-1", status: "held" } })
    })
})

describe("AgentWorkReadService.customerWake", () => {
    it("tells where the wake of a stored customer message stands in the words of a job", async () => {
        const { service, em } = await build(
            mockEntityManager({ findOne: [AgentWakeEntity, runningWakeRowOf("wake-7")] }),
        )

        await expect(service.customerWake("ws-1", "msg-1")).resolves.toEqual({ id: "wake-7", state: "running" })
        expect(em.findOne).toHaveBeenCalledWith(AgentWakeEntity, {
            where: { workspaceId: "ws-1", source: "customer", eventKey: "msg-1" },
        })
    })

    it("answers null for a message no wake was written for", async () => {
        const { service } = await build(mockEntityManager({ findOne: [AgentWakeEntity, null] }))

        await expect(service.customerWake("ws-1", "msg-9")).resolves.toBeNull()
    })
})
