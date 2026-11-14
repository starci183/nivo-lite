import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { WorkflowTriggerPickEntity } from "./persistence/entities"
import type { TriggerPick } from "./policies/trigger-readiness.policy"

/** The most picks one workflow holds that a read returns (one per purpose and contested stream: a handful in practice). */
const PICK_LIMIT = 200

/** One pick to write: the workflow it is for, then the pick. */
export interface WorkflowTriggerPickWrite extends TriggerPick {
    /** The workflow the pick is written for. */
    readonly workflowId: string
}

@Injectable()
/**
 * The one reader and writer of public.workflow_trigger_picks (owner key `triggerOneSource2026_11_12`, CORRECTED 2026-11-12): the founder's
 * pick of the ONE source of a stream two attached accounts read, per workflow and trigger purpose, kept apart from any graph version so
 * it survives a re-publish. One row per (workspace, workflow, verb, stream): a new pick of a stream replaces the old one. The writer
 * judges nothing: the consent road (`AgentWorkflowRunsService.triggerPicksOf`) only hands it picks it checked.
 */
export class WorkflowTriggerPicksService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
    ) {}

    /** The picks of one workflow of an agent. */
    async picksOf(workspaceId: string, agentId: string, workflowId: string): Promise<ReadonlyArray<TriggerPick>> {
        const rows = await this.entityManager.find(WorkflowTriggerPickEntity, {
            select: { verb: true, stream: true, connectionId: true },
            where: { workspaceId, agentId, workflowId },
            order: { verb: "ASC", stream: "ASC" },
            take: PICK_LIMIT,
        })
        return rows.map((row) => ({ verb: row.verb, stream: row.stream, connectionId: row.connectionId }))
    }

    /** Writes the picks of a member for an agent's workflows; answers how many rows were written. */
    async record(
        workspaceId: string,
        agentId: string,
        pickedBy: string,
        picks: ReadonlyArray<WorkflowTriggerPickWrite>,
    ): Promise<number> {
        if (picks.length === 0) return 0
        const pickedAt = this.clock.now()
        await this.entityManager.upsert(
            WorkflowTriggerPickEntity,
            picks.map((pick) => ({
                workspaceId,
                agentId,
                workflowId: pick.workflowId,
                verb: pick.verb,
                stream: pick.stream,
                connectionId: pick.connectionId,
                pickedBy,
                pickedAt,
            })),
            ["workspaceId", "workflowId", "verb", "stream"],
        )
        return picks.length
    }
}
