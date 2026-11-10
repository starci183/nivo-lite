import { Injectable } from "@nestjs/common"
import type { OnModuleInit } from "@nestjs/common"
import { AgentTagService } from "@modules/domain/agent-work"
import { AgentDirectoryService } from "@modules/domain/agents"
import { ModuleJobRunnerService } from "@modules/domain/entity-engine"
import type { EngineWorkflowProvider, JobWorkflowBinding } from "@modules/domain/entity-engine"
import { WORKFLOW_CALL_MEMBER, WORKFLOW_PARAMS_MEMBER } from "@nivo-lite/agent-sdk/graph"
import type { WorkflowApi } from "@nivo-lite/agent-sdk/mutation"
import { EntityEngineDoorError, EntityEngineDoorErrorCode } from "./errors/entity-engine-door.error"

/** What started the wake: the engine, for a declared job. */
const SOURCE = "engine.workflow"

@Injectable()
/**
 * The provider of the `engine.workflow` port: a declared job starts a workflow of a module. It wakes the module's agent the way a
 * hand-off does (a tag pinned to the workflow and version, carrying the inputs as the data the workflow's trigger reads), so the run
 * is opened by the same wake path as any other. The wake is keyed by the job's `dedupeKey`: the same key starts the workflow once.
 * It is never called while an engine scope is open (no transaction spans the wake of a run).
 */
export class EngineWorkflowService implements EngineWorkflowProvider, OnModuleInit {
    constructor(
        private readonly agents: AgentDirectoryService,
        private readonly tags: AgentTagService,
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
                const tagged = await this.tags.tagAgent({
                    source: SOURCE,
                    workspaceId: binding.workspaceId,
                    toAgentId: agentId,
                    text: `${request.moduleKey}.${request.workflow}`,
                    context: {
                        [WORKFLOW_CALL_MEMBER]: { workflow: request.workflow, version: request.version },
                        [WORKFLOW_PARAMS_MEMBER]: { ...request.inputs },
                    },
                    eventKey: `workflow-start:${request.dedupeKey}`,
                })
                if (tagged.tagged) return { started: true }
                return { started: false, reason: tagged.reason === "duplicate" ? "duplicate" : "refused" }
            },
        }
    }
}
