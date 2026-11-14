import { Injectable } from "@nestjs/common"
import { LATEST_VERSION } from "@nivo-lite/agent-sdk/graph"
import type { EntityManager } from "typeorm"
import { WORKFLOW_CALL_TRIGGER } from "@modules/domain/agent-schedules/workflow-call.trigger"
import { ProviderTriggersService } from "@modules/domain/provider-triggers"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { isWorkflowStartPayload } from "@modules/queues/workflow-start"
import { AgentGraphsLogEvent } from "./agent-graphs.log-events"

@Injectable()
/**
 * A PERSON'S START of a workflow enters the one event pipeline here (concept triggers rule 13), run by the api only (the one app that
 * drives runs; R24): the queued start (written by whichever app the person used, after the person's right, the workflow's runnability and
 * its contract were checked there) becomes ONE `workflow.called` event, its data the inputs, pinned to the workflow at its running version,
 * the person beside it, and is handed to the ONE delivery function for the installation's agent. NOT provided by the agent-graphs module:
 * only the api's job module composes it, so the mcp app composes no delivery.
 */
export class AgentWorkflowStartDeliveryService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        private readonly triggers: ProviderTriggersService,
    ) {}

    /** Delivers the start a job names; a payload that is no start (only the start writes the job) ends the job doing nothing. */
    async deliverJob(payload: object): Promise<void> {
        if (!isWorkflowStartPayload(payload)) return
        const event = WORKFLOW_CALL_TRIGGER.translate({ key: payload.key, params: payload.inputs }, { connectionId: null })
        if (event === null) return
        const result = await this.entityManager.transaction((tx) =>
            this.triggers.deliver(
                {
                    workspaceId: payload.workspaceId,
                    declaration: WORKFLOW_CALL_TRIGGER,
                    connectionId: null,
                    agentId: payload.agentId,
                    events: [
                        {
                            event,
                            pin: { workflow: payload.workflowKey, version: LATEST_VERSION },
                            actorMemberId: payload.memberId,
                        },
                    ],
                },
                tx,
            ),
        )
        // A start the workflow no longer takes (paused or replaced between the start and its delivery) is said, never dropped silently.
        if (result.status !== "delivered" || (result.woken.length === 0 && result.repeats === 0))
            this.logger.warn(AgentGraphsLogEvent.WorkflowStartUntaken, {
                workspaceId: payload.workspaceId,
                agentId: payload.agentId,
                workflow: payload.workflowKey,
                key: payload.key,
            })
    }
}
