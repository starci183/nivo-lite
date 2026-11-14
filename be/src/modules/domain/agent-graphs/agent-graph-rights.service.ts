import { Injectable } from "@nestjs/common"
import type { GraphSpec } from "@nivo-lite/agent-sdk/graph"
import { EntityEngineService, type ScopedTx } from "@modules/domain/entity-engine"
import { AgentWorkflowRecordsService } from "./agent-workflow-records.service"
import type { OptionalStepTitle } from "./agent-workflow-rights.contracts"
import type { WorkflowRecord } from "./agent-workflows.contracts"
import { noRights, type AddedRight, type RightsConsent, type RightsSettlement } from "./policies/node-rights-gate.policy"
import { snapshotHashOf, snapshotOf, workflowNotFound } from "./policies/workflow-view.policy"

/** One activation the gate is asked about. */
export interface RightsQuestion {
    /** The workspace. */
    readonly workspaceId: string
    /** The agent the workflow belongs to. */
    readonly agentId: string
    /** The workflow whose grant rows are read; null for one that does not exist yet (it holds nothing). */
    readonly workflowId: string | null
    /** The graph that runs now; null when none does. */
    readonly before: GraphSpec | null
    /** The graph that would run. */
    readonly after: GraphSpec
    /** The person activating and what the owner agreed; absent on a road no person walks (a seed, an adoption), which never refuses. */
    readonly consent?: RightsConsent | undefined
    /**
     * True on an install, a seed, an adoption, a copy or a template accept: what the workspace's agreement rule grants (see
     * `AgentGraphRightsService.ruleOf`) is agreed without a person. False on an edit, a rollback or a proposal: only the owner agrees.
     */
    readonly byTemplate: boolean
    /**
     * True on the road of an agent made in the same call (a template install, a setup copy): what the owner has not agreed waits
     * instead of refusing, since the list is keyed by the accounts of an agent that did not exist when the call was made.
     */
    readonly waits?: boolean | undefined
}

/** One entry a refusal lists for the owner: the entry, and the title of the step that asks, so no screen shows a node key alone. */
export interface RefusedRight extends AddedRight {
    /** The title of the step the node runs, in the owner's two languages; null for a step no installed node is. */
    readonly stepTitle: OptionalStepTitle
}

/** A workflow as it stands when the gate is asked: its record and the graph that runs. */
export interface WorkflowStanding {
    /** The workflow. */
    readonly workflow: WorkflowRecord
    /** The graph of the version that runs (the newest when none runs yet). */
    readonly before: GraphSpec
}

/** One activation of an existing workflow the gate is asked about. */
export interface WorkflowRightsQuestion {
    /** The workspace. */
    readonly workspaceId: string
    /** The workflow. */
    readonly workflowId: string
    /** The graph that would run, read in the transaction that reads the workflow as it stands. */
    readonly afterOf: (tx: ScopedTx, standing: WorkflowStanding) => Promise<GraphSpec>
    /** The person activating and what the owner agreed; absent on a road no person walks. */
    readonly consent?: RightsConsent | undefined
    /** See `RightsQuestion.byTemplate`. */
    readonly byTemplate: boolean
}

/** What the gate says of one activation without refusing it. */
export interface RightsJudgement {
    /** The settlement to write when nothing is refused. */
    readonly settlement: RightsSettlement
    /** The entries that still need the owner's yes, each with the title of its step; empty when the activation may go on. */
    readonly refused: ReadonlyArray<RefusedRight>
}

@Injectable()
/**
 * What an activation of a workflow version settles about rights (nivo-frame `rights`): NOTHING to agree. The publish / install GATE
 * ("a version asking more rights needs the owner's yes") is REMOVED: a node's mode is declared in its version (editing it is publishing a
 * version), the agent's attachments say which accounts it may act on (detaching is the kill switch), and no grant row is written or read.
 * Every activation goes through with the settlement that grants nothing (`noRights`). The seams stay so the publish paths keep one shape.
 */
export class AgentGraphRightsService {
    constructor(
        private readonly engine: EntityEngineService,
        private readonly workflows: AgentWorkflowRecordsService,
    ) {}

    /** Decides one activation: always the settlement that grants and asks nothing (there is no gate). */
    async decide(question: RightsQuestion): Promise<RightsSettlement> {
        return (await this.judge(question)).settlement
    }

    /** Judges one activation without refusing it: the settlement that grants nothing, and nothing refused. */
    judge(question: RightsQuestion): Promise<RightsJudgement> {
        const settlement = noRights(snapshotHashOf(question.after), question.agentId, question.workflowId)
        return Promise.resolve({ settlement, refused: [] })
    }

    /**
     * Decides one activation of an existing workflow: reads the workflow and the graph it runs, takes the graph that would run from
     * the road, and decides as `decide` does. Writes nothing.
     */
    async decideWorkflow(question: WorkflowRightsQuestion): Promise<RightsSettlement> {
        const { workspaceId, workflowId, consent, byTemplate } = question
        const read = await this.engine.scoped(workspaceId, async (tx) => {
            const workflow = await this.workflows.workflow(tx, workflowId)
            if (workflow === null) throw workflowNotFound()
            const running =
                workflow.activeVersionId === null
                    ? ((await this.workflows.versionsOf(tx, workflowId, 1)).at(0) ?? null)
                    : await this.workflows.version(tx, workflow.activeVersionId)
            if (running === null) throw workflowNotFound()
            const before = snapshotOf(running)
            return { workflow, before, after: await question.afterOf(tx, { workflow, before }) }
        })
        const { agentId } = read.workflow
        return this.decide({
            workspaceId,
            agentId,
            workflowId,
            before: read.before,
            after: read.after,
            consent,
            byTemplate,
        })
    }
}
