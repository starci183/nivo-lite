import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { TOOL } from "@nivo-lite/blocks-core"
import { AgentTasksService } from "@modules/domain/agent-work"
import { GraphNodeRegistryService } from "@modules/domain/graph-nodes"
import type { NodeTurn } from "@modules/domain/graph-nodes"
import { CLOCK } from "@modules/platform/clock"
import { LOGGER } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { CareScheduleEffectService } from "./care-schedule-effect.service"
import { AgentsErrorCode } from "./errors/agents.error"

const NOW = "2026-11-09T03:00:00.000Z"

const TURN: NodeTurn = {
    turnId: "run-1",
    workspaceId: "ws-1",
    agentId: "sales-1",
    subject: null,
    conversationId: null,
    locale: "vi",
}

const CALL = { key: "run-1:await:0", dedupeKey: "care-arm:payment-reminder:o1" }

const build = async () => {
    const registry = mock<GraphNodeRegistryService>()
    const tasks = mock<AgentTasksService>({ apply: jest.fn().mockResolvedValue(undefined) })
    const logger = mock<Logger>()
    const moduleRef = await Test.createTestingModule({
        providers: [
            CareScheduleEffectService,
            { provide: CLOCK, useValue: new FakeClock(NOW) },
            { provide: LOGGER, useValue: logger },
            { provide: GraphNodeRegistryService, useValue: registry },
            { provide: AgentTasksService, useValue: tasks },
        ],
    }).compile()
    return { executor: moduleRef.get(CareScheduleEffectService), registry, tasks, logger }
}

describe("CareScheduleEffectService", () => {
    it("registers as the executor of the care schedule tool", async () => {
        const { executor, registry } = await build()
        executor.onModuleInit()
        expect(registry.addExecutor).toHaveBeenCalledWith(executor)
        expect(executor.effect).toBe(TOOL.careSchedule)
    })

    it("arms the step as one task of the agent, keyed by the step and the record, with the real moment in its title", async () => {
        const { executor, tasks, logger } = await build()

        await expect(
            executor.execute(TURN, { kind: "payment-reminder", ref: "o1", dueAt: "2026-11-09T05:00:00.000Z" }, CALL),
        ).resolves.toEqual({ kind: "agent-task", id: "care:payment-reminder:o1" })

        expect(tasks.apply).toHaveBeenCalledWith("ws-1", "sales-1", [
            {
                op: "add",
                key: "care:payment-reminder:o1",
                title: "care due 2026-11-09T05:00:00.000Z",
                nextActionAt: new Date("2026-11-09T05:00:00.000Z"),
            },
        ])
        expect(logger.info).toHaveBeenCalledWith("agents.care_scheduled", {
            agentId: "sales-1",
            kind: "payment-reminder",
            dueAt: "2026-11-09T05:00:00.000Z",
        })
    })

    it("arms a step given in hours after the engine's clock, so the agent reading its policy types no instant", async () => {
        const { executor, tasks } = await build()

        await executor.execute(TURN, { kind: "payment-stale", ref: "o1", afterHours: 24 }, CALL)

        expect(tasks.apply.mock.calls[0]?.[2]).toEqual([
            {
                op: "add",
                key: "care:payment-stale:o1",
                title: "care due 2026-11-10T03:00:00.000Z",
                nextActionAt: new Date("2026-11-10T03:00:00.000Z"),
            },
        ])
    })

    it("keeps the suffix of an occasion in the key, so two dates of one customer are two tasks", async () => {
        const { executor, tasks } = await build()

        await executor.execute(
            TURN,
            { kind: "occasion", ref: "l1", dueAt: "2026-12-01T00:00:00.000Z", suffix: "birthday-12-8" },
            CALL,
        )

        expect(tasks.apply.mock.calls[0]?.[2]).toMatchObject([{ key: "care:occasion:l1:birthday-12-8" }])
    })

    it("refuses for good a step no schedule can hold: an unknown step, a moment that is not an instant, or one months away", async () => {
        const { executor, tasks } = await build()
        const refused = { code: AgentsErrorCode.CareScheduleInvalid, params: { refusal: "EFFECT_PAYLOAD_INVALID" } }

        await expect(
            executor.execute(TURN, { kind: "mystery", ref: "o1", dueAt: "2026-11-09T05:00:00.000Z" }, CALL),
        ).rejects.toMatchObject(refused)
        await expect(executor.execute(TURN, { kind: "occasion", ref: "o1", dueAt: "soon" }, CALL)).rejects.toMatchObject(
            refused,
        )
        await expect(
            executor.execute(TURN, { kind: "occasion", ref: "o1", dueAt: "2027-06-01T00:00:00.000Z" }, CALL),
        ).rejects.toMatchObject(refused)
        await expect(executor.execute(TURN, { kind: "payment-reminder", ref: "o1" }, CALL)).rejects.toMatchObject(refused)
        await expect(
            executor.execute(
                TURN,
                { kind: "payment-reminder", ref: "o1", dueAt: "2026-11-09T05:00:00.000Z", afterHours: 2 },
                CALL,
            ),
        ).rejects.toMatchObject(refused)
        expect(tasks.apply).not.toHaveBeenCalled()
    })
})
