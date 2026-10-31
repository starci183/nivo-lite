import { Injectable } from "@nestjs/common"
import { AgentGoalsService, AgentTasksService } from "@modules/domain/agent-work"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import type { AgentProbe, ProbeAgent, ProbeAnswer } from "../agent-schedules.contracts"
import { dueBriefOf, dueWorkOf } from "./probe-brief.policy"

@Injectable()
/** Looks at the agent's own to-do: an open task whose wake time has come, or an active goal that passed its date unreviewed. */
export class TasksDueProbeService implements AgentProbe {
    readonly key = "tasks_due"

    constructor(
        private readonly tasks: AgentTasksService,
        private readonly goals: AgentGoalsService,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** Answers the tasks and goals that are due, or no work. */
    async check(agent: ProbeAgent): Promise<ProbeAnswer> {
        const [tasks, goals] = await Promise.all([this.tasks.alive(agent.agentId), this.goals.alive(agent.agentId)])
        const due = dueWorkOf(tasks, goals, this.clock.now())
        if (due.tasks.length === 0 && due.goals.length === 0) return { work: false }
        return {
            work: true,
            brief: dueBriefOf(due),
            subjectIds: [...due.tasks.map((task) => task.id), ...due.goals.map((goal) => goal.id)],
        }
    }
}
