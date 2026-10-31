import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentWakeService } from "@modules/domain/agent-work"
import { AgentsService } from "@modules/domain/agents"
import { AutomationExtensionsService } from "@modules/domain/automations"
import type { ExecutorContext, ExecutorPayload } from "@modules/domain/automations"
import type { RunResult } from "@modules/domain/automation-runs"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectMessageCatalog } from "@modules/platform/i18n"
import type { MessageCatalog } from "@modules/platform/i18n"
import { textOf } from "./background-work.policy"

@Injectable()
/**
 * The `wake_agent` executor of the automations engine: a pipeline that meets a case it cannot settle by rule hands it to the running
 * agent of its department. The agent is woken as an internal wake keyed by the run and the step, so a retried run hands over once; what
 * the agent then proposes goes through the authority gate like everything it does. The engine stays deterministic: it only writes the wake.
 */
export class WakeAgentExecutorService implements OnModuleInit {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectMessageCatalog() private readonly catalog: MessageCatalog,
        private readonly extensions: AutomationExtensionsService,
        private readonly agents: AgentsService,
        private readonly wakes: AgentWakeService,
    ) {}

    /** Plugs the executor into the engine once the app has started. */
    onModuleInit(): void {
        this.extensions.add({ executors: { wake_agent: (context, payload) => this.wake(context, payload) } })
    }

    /** Hands the case of the run to the running agent of the pipeline's department; skips when it has none. */
    async wake(context: ExecutorContext, payload: ExecutorPayload): Promise<RunResult> {
        const department = context.pipeline.module_key
        const agent =
            department === null ? null : await this.agents.profileOfDepartment(context.workspaceId, department)
        if (agent === null) {
            const label = this.say("noAgentRunning")
            return { status: "skipped", steps: [{ label, status: "skipped", detail: label }] }
        }
        const subject = textOf(payload.subjectId)
        const woke = await this.entityManager.transaction((tx) =>
            this.wakes.wake(tx, {
                workspaceId: context.workspaceId,
                agentId: agent.id,
                source: "internal",
                eventKey: `${textOf(payload.runId) || context.pipeline.id}:${textOf(payload.step) || "wake"}`,
                context: { eventName: "automation_case", ...(subject === "" ? {} : { subjectId: subject }) },
                actorMemberId: null,
            }),
        )
        return {
            status: "done",
            steps: [{ label: this.say(woke ? "caseHandedOver" : "caseAlreadyHanded"), status: "done" }],
        }
    }

    private say(key: string): string {
        return this.catalog.get(`agentSchedules.${key}`, {}, "vi")
    }
}
