import { Test } from "@nestjs/testing"
import { FakeClock, mock, mockEntityManager } from "@starci/jest-preset"
import type { MockEntityManager } from "@starci/jest-preset"
import { In } from "typeorm"
import {
    agentGoalRowOf,
    agentGoalWriteOf,
    doneGoalRowOf,
    moduleGoalRowOf,
    pausedGoalRowOf,
} from "@tests/fixtures/builders/agent-work.builder"
import { CLOCK } from "@modules/platform/clock"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { AgentGoalsService } from "./agent-goals.service"
import { AgentWorkAccessService } from "./agent-work-access.service"
import { AgentWorkErrorCode } from "./errors/agent-work.error"
import { AgentGoalEntity } from "./persistence/entities"

const NOW = "2026-11-10T03:00:00.000Z"

const build = async (em: MockEntityManager = mockEntityManager()) => {
    const access = mock<AgentWorkAccessService>({
        manager: jest.fn().mockResolvedValue("seat-1"),
        agent: jest.fn().mockResolvedValue(undefined),
    })
    const container = await Test.createTestingModule({
        providers: [
            AgentGoalsService,
            { provide: PRIMARY_ENTITY_MANAGER, useValue: em },
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: AgentWorkAccessService, useValue: access },
        ],
    }).compile()
    return { service: container.get(AgentGoalsService), em, access }
}

describe("AgentGoalsService.alive", () => {
    it("lists the active and paused goals of the agent, newest first", async () => {
        const { service, em } = await build(
            mockEntityManager({
                find: [AgentGoalEntity, [agentGoalRowOf(), pausedGoalRowOf()]],
            }),
        )

        const goals = await service.alive("agent-1")

        expect(goals.map((goal) => [goal.id, goal.status])).toEqual([
            ["goal-1", "active"],
            ["goal-2", "paused"],
        ])
        expect(em.find).toHaveBeenCalledWith(AgentGoalEntity, {
            where: { agentId: "agent-1", status: In(["active", "paused"]) },
            order: { createdAt: "DESC" },
            take: 50,
        })
    })
})

describe("AgentGoalsService.save", () => {
    it("creates a goal for an owner or manager under their seat", async () => {
        const { service, em, access } = await build(mockEntityManager({ save: [AgentGoalEntity, agentGoalRowOf()] }))

        await expect(service.save("user-1", agentGoalWriteOf())).resolves.toMatchObject({
            id: "goal-1",
            source: "owner",
        })

        expect(access.manager).toHaveBeenCalledWith("user-1", "ws-1")
        expect(access.agent).toHaveBeenCalledWith("ws-1", "agent-1")
        expect(em.save).toHaveBeenCalledWith(AgentGoalEntity, {
            workspaceId: "ws-1",
            agentId: "agent-1",
            createdByMember: "seat-1",
            title: "Keep receivables under 30 days",
            detail: "",
            status: "active",
            source: "owner",
            dueAt: null,
        })
    })

    it("lets a module write a goal with no member behind it", async () => {
        const { service, em, access } = await build(
            mockEntityManager({
                save: [AgentGoalEntity, moduleGoalRowOf()],
            }),
        )

        await service.save(null, agentGoalWriteOf({ source: "module" }))

        expect(access.manager).not.toHaveBeenCalled()
        expect(em.save).toHaveBeenCalledWith(
            AgentGoalEntity,
            expect.objectContaining({ createdByMember: null, source: "module" }),
        )
    })

    it("credits the member the system names when a module writes on their behalf", async () => {
        const { service, em } = await build(mockEntityManager({ save: [AgentGoalEntity, agentGoalRowOf()] }))

        await service.save(null, agentGoalWriteOf({ memberId: "seat-7" }))

        expect(em.save).toHaveBeenCalledWith(AgentGoalEntity, expect.objectContaining({ createdByMember: "seat-7" }))
    })
})

describe("AgentGoalsService.save, changing a goal", () => {
    it("changes a goal of the agent and answers it as it is now", async () => {
        const { service, em } = await build(
            mockEntityManager({
                update: [AgentGoalEntity, { affected: 1 }],
                findOne: [AgentGoalEntity, doneGoalRowOf()],
            }),
        )

        await expect(
            service.save("user-1", agentGoalWriteOf({ goalId: "goal-1", status: "done" })),
        ).resolves.toMatchObject({
            status: "done",
        })

        expect(em.update).toHaveBeenCalledWith(
            AgentGoalEntity,
            { id: "goal-1", agentId: "agent-1", workspaceId: "ws-1" },
            { title: "Keep receivables under 30 days", detail: "", status: "done", source: "owner", dueAt: null },
        )
    })

    it("refuses to change a goal that is not the agent's", async () => {
        const { service } = await build(mockEntityManager({ update: [AgentGoalEntity, { affected: 0 }] }))

        await expect(service.save("user-1", agentGoalWriteOf({ goalId: "goal-9" }))).rejects.toMatchObject({
            code: AgentWorkErrorCode.GoalNotFound,
        })
    })

    it("refuses a goal that vanished between the change and the read", async () => {
        const { service } = await build(
            mockEntityManager({
                update: [AgentGoalEntity, { affected: 1 }],
                findOne: [AgentGoalEntity, null],
            }),
        )

        await expect(service.save("user-1", agentGoalWriteOf({ goalId: "goal-1" }))).rejects.toMatchObject({
            code: AgentWorkErrorCode.GoalNotFound,
        })
    })

    it("refuses staff and an agent of another workspace before writing", async () => {
        const staff = await build()
        staff.access.manager.mockRejectedValueOnce(new Error("staff"))
        const foreign = await build()
        foreign.access.agent.mockRejectedValueOnce(new Error("foreign"))

        await expect(staff.service.save("user-3", agentGoalWriteOf())).rejects.toThrow("staff")
        await expect(foreign.service.save("user-1", agentGoalWriteOf())).rejects.toThrow("foreign")
        expect(staff.em.save).not.toHaveBeenCalled()
        expect(foreign.em.save).not.toHaveBeenCalled()
    })
})

describe("AgentGoalsService.markReviewed", () => {
    it("notes the review time on the goals of the agent", async () => {
        const { service, em } = await build(mockEntityManager({ update: [AgentGoalEntity, { affected: 2 }] }))

        await service.markReviewed("agent-1", ["goal-1", "goal-2"])

        expect(em.update).toHaveBeenCalledWith(
            AgentGoalEntity,
            { agentId: "agent-1", id: In(["goal-1", "goal-2"]) },
            { reviewedAt: new Date(NOW) },
        )
    })

    it("does nothing for no goals", async () => {
        const { service, em } = await build()

        await service.markReviewed("agent-1", [])

        expect(em.update).not.toHaveBeenCalled()
    })
})
