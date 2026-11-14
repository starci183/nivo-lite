import { Injectable } from "@nestjs/common"
import { LATEST_VERSION, type WorkflowCallPin } from "@nivo-lite/agent-sdk/graph"
import type { EntityManager } from "typeorm"
import { InstallationRecordsService } from "@modules/domain/module-installations"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectQueueOutbox, type QueueOutbox } from "@modules/platform/queue"
import { WORKFLOW_START_QUEUE, WorkflowStartJob, workflowStartKeyOf, type WorkflowStartPayload } from "@modules/queues/workflow-start"
import type { GraphActor } from "./agent-graph-admin.service"
import { AgentWorkflowRunsService } from "./agent-workflow-runs.service"
import { AgentWorkflowsAdminService } from "./agent-workflows-admin.service"
import type { WorkflowRequest } from "./agent-workflows-door.contracts"
import {
    WORKFLOW_START_INPUTS_MAX,
    runnableOf,
    workflowInputIssuesOf,
    workflowInputSchemaOf,
    type WorkflowInputIssue,
    type WorkflowStartRefusal,
} from "./policies/workflow-start.policy"

/** Whether a person may start one workflow, and the JSON Schema of the inputs it declares. */
export interface WorkflowStartView {
    /** The workflow. */
    readonly workflowId: string
    /** Its key within the agent. */
    readonly key: string
    /** Its name. */
    readonly name: string
    /** active, draft or paused. */
    readonly status: string
    /** True when a person may start it now. */
    readonly runnable: boolean
    /** Why not, or null. */
    readonly refusal: WorkflowStartRefusal | null
    /** The JSON Schema of its declared input, or null when it cannot be started. */
    readonly inputSchema: Readonly<Record<string, unknown>> | null
    /** The same JSON Schema as JSON text (what the GraphQL type carries), or null when it cannot be started. */
    readonly inputSchemaJson: string | null
}

/** A person's start of a workflow: which one, its inputs, and the key that makes the start once-only. */
export interface WorkflowStartRequest extends WorkflowRequest {
    /** The inputs, as the workflow's declared contract takes them. */
    readonly inputs: Readonly<Record<string, unknown>>
    /** One stable key per intended start, reused on its retries: the same key starts the workflow once. */
    readonly opKey: string
}

/** Why a start wrote nothing. */
export type WorkflowStartRefused = WorkflowStartRefusal | "no_agent" | "not_member" | "input_invalid" | "waiting_for_connection" | "too_large"

/** What a start came to. */
export interface WorkflowStartAnswer {
    /** `started` (the start is queued for the engine; the same opKey again is the same start), `refused` (nothing written). */
    readonly status: "started" | "refused"
    /** Why it was refused, or null. */
    readonly refusal: WorkflowStartRefused | null
    /** The inputs' problems of an `input_invalid` refusal. */
    readonly issues: ReadonlyArray<WorkflowInputIssue>
}

const refusedWith = (refusal: WorkflowStartRefused, issues: ReadonlyArray<WorkflowInputIssue> = []): WorkflowStartAnswer => ({
    status: "refused",
    refusal,
    issues,
})

@Injectable()
/**
 * A person starts one workflow of an installed agent by hand (the MCP `workflow.run`, its GraphQL `runWorkflow`) as the SAME event an end
 * hand-off is (`workflow.called`, pinned to the workflow at its running version, the inputs as its data, the person beside it). The
 * workflows door reads the workflow first (an owner or a manager, and the workflow must be the installation's agent's), the workflow must
 * be runnable (`runnableOf`), the inputs must fit its declared contract, and readiness must show it (a blocking node with none of its
 * providers connected hides it); otherwise nothing is written. The start is then queued ONCE per (person, opKey) for the api, which
 * delivers it through the one event pipeline (`AgentWorkflowStartDeliveryService`; R24): the app the person used (the api, or the mcp
 * gateway) composes no delivery and drives no run.
 */
export class AgentWorkflowStartService {
    constructor(
        private readonly admin: AgentWorkflowsAdminService,
        private readonly installations: InstallationRecordsService,
        private readonly seats: WorkspaceMemberSeatsService,
        private readonly runs: AgentWorkflowRunsService,
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectQueueOutbox() private readonly outbox: QueueOutbox,
    ) {}
    /** Whether the person may start the workflow, and the JSON Schema of its declared input (the workflows door's guard applies). */
    async runnable(actor: GraphActor, request: WorkflowRequest): Promise<WorkflowStartView> {
        const { workflow, graphJson } = await this.admin.detail(actor, request)
        const judged = runnableOf(graphJson, workflow.status)
        const inputSchema = judged.runnable ? workflowInputSchemaOf(judged.contract) : null
        return {
            workflowId: workflow.id,
            key: workflow.key,
            name: workflow.name,
            status: workflow.status,
            runnable: judged.runnable,
            refusal: judged.runnable ? null : judged.refusal,
            inputSchema,
            inputSchemaJson: inputSchema === null ? null : JSON.stringify(inputSchema),
        }
    }

    /** Starts the workflow once for the opKey, or answers why nothing was written. */
    async start(actor: GraphActor, request: WorkflowStartRequest): Promise<WorkflowStartAnswer> {
        const { workflow, graphJson } = await this.admin.detail(actor, request)
        const judged = runnableOf(graphJson, workflow.status)
        if (!judged.runnable) return refusedWith(judged.refusal)
        const issues = workflowInputIssuesOf(judged.contract, request.inputs)
        if (issues.length > 0) return refusedWith("input_invalid", issues)
        const installation = await this.installations.find(actor.workspaceId, request.installationId)
        const agentId = installation?.agentId ?? null
        if (installation === null || agentId === null) return refusedWith("no_agent")
        const pin: WorkflowCallPin = { workflow: workflow.key, version: LATEST_VERSION }
        if ((await this.runs.hiddenTargetOf(actor.workspaceId, agentId, pin)) !== null) return refusedWith("waiting_for_connection")
        const seat = await this.seats.activeSeatOfUser(actor.workspaceId, actor.principalId)
        if (seat === null) return refusedWith("not_member")
        if (JSON.stringify(request.inputs).length > WORKFLOW_START_INPUTS_MAX) return refusedWith("too_large")
        const payload: WorkflowStartPayload = {
            workspaceId: actor.workspaceId,
            agentId,
            memberId: seat.memberId,
            workflowKey: workflow.key,
            key: workflowStartKeyOf(actor.principalId, request.opKey),
            inputs: { ...request.inputs },
        }
        await this.entityManager.transaction((tx: EntityManager) =>
            this.outbox.write(tx, WORKFLOW_START_QUEUE, payload, { job: WorkflowStartJob.Deliver, dedupeKey: payload.key }),
        )
        return { status: "started", refusal: null, issues: [] }
    }
}
