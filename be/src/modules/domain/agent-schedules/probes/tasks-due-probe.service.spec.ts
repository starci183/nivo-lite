import { Test } from "@nestjs/testing"
import { FakeClock, mock } from "@starci/jest-preset"
import { AgentGoalsService, AgentTasksService } from "@modules/domain/agent-work"
import { CLOCK } from "@modules/platform/clock"
import { TasksDueProbeService } from "./tasks-due-probe.service"

const NOW = "2026-11-10T03:00:00.000Z"
const AGENT = { workspaceId: "ws-1", agentId: "agent-1" }

describe("TasksDueProbeService", () => {
    const build = async (due: boolean) => {
        const tasks = mock<AgentTasksService>({
            alive: jest.fn().mockResolvedValue(
                due
                    ? [
                          {
                              id: "task-1",
                              status: "open",
                              title: "Chase invoice 12",
                              nextActionAt: new Date("2026-11-10T02:00:00.000Z"),
                          },
                      ]
                    : [],
            ),
        })
        const goals = mock<AgentGoalsService>({ alive: jest.fn().mockResolvedValue([]) })
        const container = await Test.createTestingModule({
            providers: [
                TasksDueProbeService,
                { provide: AgentTasksService, useValue: tasks },
                { provide: AgentGoalsService, useValue: goals },
                { provide: CLOCK, useValue: new FakeClock(NOW) },
            ],
        }).compile()
        return { probe: container.get(TasksDueProbeService), tasks, goals }
    }

    it("finds the tasks that are due, with a brief and their ids", async () => {
        const { probe, tasks, goals } = await build(true)

        await expect(probe.check(AGENT)).resolves.toEqual({
            work: true,
            brief: "Tasks due: Chase invoice 12.",
            subjectIds: ["task-1"],
        })
        expect(tasks.alive).toHaveBeenCalledWith("agent-1")
        expect(goals.alive).toHaveBeenCalledWith("agent-1")
        expect(probe.key).toBe("tasks_due")
    })

    it("finds no work when nothing is due", async () => {
        const { probe } = await build(false)

        await expect(probe.check(AGENT)).resolves.toEqual({ work: false })
    })
})
