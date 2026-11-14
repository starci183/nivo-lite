import { Injectable, Optional } from "@nestjs/common"
import { EntityEngineService } from "@modules/domain/entity-engine"
import { AccountAttachmentsService } from "@modules/domain/tool-grants"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import type { NamedWorkflowGraph, WorkflowRightsStanding } from "./agent-workflow-rights.contracts"
import { standingRightsOf } from "./policies/node-rights-gate.policy"
import { optionalSnapshotOf } from "./policies/workflow-view.policy"

/** The most workflows of a workspace a roll-up reads. */
const WORKSPACE_WORKFLOW_LIMIT = 500

@Injectable()
/**
 * WHAT THE RUNNING WORKFLOWS STAND ON (nivo-frame `rights`): the read both rights roll-ups show: each running node, in its ONE declared
 * mode, on the accounts its providers bind among its agent's attachments. Nothing is granted or waits: there is nothing to agree.
 */
export class AgentRightsStandingService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly workflows: AgentWorkflowRecordsService,
        @Optional() private readonly access?: AccountAttachmentsService,
    ) {}

    /** What every running workflow of the workspace stands on, entry by entry (`standingRightsOf`). Read only. */
    async standingOf(workspaceId: string): Promise<ReadonlyArray<WorkflowRightsStanding>> {
        const graphs = await this.namedGraphsOf(workspaceId)
        if (this.access === undefined) return graphs.map((graph) => ({ ...graph, entries: [] }))
        const attachments = await this.access.listOfWorkspace(workspaceId)
        return graphs.map((graph) => {
            const accounts = attachments.filter((row) => row.agentId === graph.agentId)
            return { ...graph, entries: standingRightsOf(graph.graph.nodes, accounts) }
        })
    }

    /**
     * The graph every workflow of the workspace runs now, each with the key and the name of its workflow. Read only; a workflow with
     * no active version, or whose snapshot no longer parses, has no entry.
     */
    private namedGraphsOf(workspaceId: string): Promise<ReadonlyArray<NamedWorkflowGraph>> {
        return this.engine.scoped(workspaceId, async (tx) => {
            const named: Array<NamedWorkflowGraph> = []
            for (const workflow of await this.workflows.workflowsOfWorkspace(tx, WORKSPACE_WORKFLOW_LIMIT)) {
                const version =
                    workflow.activeVersionId === null
                        ? null
                        : await this.workflows.version(tx, workflow.activeVersionId)
                const graph = version === null ? null : optionalSnapshotOf(version)
                if (version === null || graph === null) continue
                named.push({
                    workflowId: workflow.id,
                    agentId: workflow.agentId,
                    versionId: version.id,
                    graph,
                    workflowKey: workflow.key,
                    workflowName: workflow.name,
                    versionNumber: version.number,
                })
            }
            return named
        })
    }
}
