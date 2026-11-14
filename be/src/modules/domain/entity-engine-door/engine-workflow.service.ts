import { Injectable, type OnModuleInit } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { AgentDirectoryService } from "@modules/domain/agents"
import { callDeliveryOf } from "@modules/domain/agent-schedules/workflow-call-delivery.policy"
import { WORKFLOW_CALL_TRIGGER } from "@modules/domain/agent-schedules/workflow-call.trigger"
import {
    ModuleJobRunnerService,
    type EngineWorkflowProvider,
    type JobWorkflowBinding,
} from "@modules/domain/entity-engine"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { WorkflowApi } from "@nivo-lite/agent-sdk/mutation"
import { EntityEngineDoorError, EntityEngineDoorErrorCode } from "./errors/entity-engine-door.error"

/** The once-key of a declared job's start: the job's own dedupe key, so the same key starts the workflow once. */
const startKeyOf = (dedupeKey: string): string => `workflow-start:${dedupeKey}`

@Injectable()
/**
 * The provider of the `engine.workflow` port: a declared job starts a workflow of a module. It is one call of the one event pipeline
 * (concept triggers rule 13): the workflow-call trigger's pure translate gives the event (its data the job's inputs, the data the
 * workflow's trigger reads as `trigger.data.*`) and the ONE delivery function writes the wake for the module's agent, pinned to the
 * workflow and version, so the run is opened by the same path as any other. The event's once-key is the job's `dedupeKey`: the same key
 * starts the workflow once. It is never called while an engine scope is open (no transaction spans the wake of a run).
 */
export class EngineWorkflowService implements EngineWorkflowProvider, OnModuleInit {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly agents: AgentDirectoryService,
        private readonly triggers: ProviderTriggersService,
        private readonly runner: ModuleJobRunnerService,
    ) {}

    /** Binds the provider to the runner of declared jobs once. */
    onModuleInit(): void {
        this.runner.bindWorkflow(this)
    }

    /** The `engine.workflow` handle of one job run. */
    workflowApi(binding: JobWorkflowBinding): WorkflowApi {
        return {
            start: async (request) => {
                if (binding.scopeOpen())
                    throw new EntityEngineDoorError({
                        code: EntityEngineDoorErrorCode.InScope,
                        params: { tool: "engine.workflow" },
                    })
                const [agentId] = await this.agents.idsOfModule(binding.workspaceId, request.moduleKey, 1)
                if (agentId === undefined) return { started: false, reason: "no_agent" }
                const event = WORKFLOW_CALL_TRIGGER.translate(
                    { key: startKeyOf(request.dedupeKey), params: request.inputs },
                    { connectionId: null },
                )
                if (event === null) return { started: false, reason: "refused" }
                const result = await this.entityManager.transaction((tx) =>
                    this.triggers.deliver(
                        {
                            workspaceId: binding.workspaceId,
                            declaration: WORKFLOW_CALL_TRIGGER,
                            connectionId: null,
                            agentId,
                            events: [{ event, pin: { workflow: request.workflow, version: request.version } }],
                        },
                        tx,
                    ),
                )
                const delivery = callDeliveryOf(result)
                if (delivery === "started") return { started: true }
                return { started: false, reason: delivery === "duplicate" ? "duplicate" : "refused" }
            },
        }
    }
}
