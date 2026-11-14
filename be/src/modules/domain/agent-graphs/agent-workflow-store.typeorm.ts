import { Injectable } from "@nestjs/common"
import type { ScopedTx } from "@modules/domain/entity-engine"
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity"
import type { AgentWorkflowTableStore } from "./agent-workflow-store.port"
import { workflowRecordOf, workflowVersionRecordOf } from "./agent-workflows.mapper"
import type {
    WorkflowInsert,
    WorkflowPatch,
    WorkflowRecord,
    WorkflowVersionInsert,
    WorkflowVersionRecord,
} from "./agent-workflows.contracts"
import { AgentWorkflowEntity, AgentWorkflowVersionEntity } from "./persistence/entities"

/** True when an insert wrote its row: Postgres answers the inserted rows, none when the conflict left it out. */
const insertedOf = (raw: unknown): boolean => Array.isArray(raw) && raw.length > 0

const workflowColumnsOf = (patch: WorkflowPatch): QueryDeepPartialEntity<AgentWorkflowEntity> => ({
    ...(patch.status === undefined ? {} : { status: patch.status }),
    ...(patch.position === undefined ? {} : { position: patch.position }),
    ...(patch.activeVersionId === undefined ? {} : { activeVersionId: patch.activeVersionId }),
    ...(patch.latestNumber === undefined ? {} : { latestNumber: patch.latestNumber }),
    ...(patch.templateId === undefined ? {} : { templateId: patch.templateId }),
    ...(patch.templateVersion === undefined ? {} : { templateVersion: patch.templateVersion }),
})

@Injectable()
/** The workflow store on its two core tables, in the caller's transaction (`ScopedTx.manager`). No raw SQL. */
export class TypeormAgentWorkflowStore implements AgentWorkflowTableStore {
    /** One workflow by id, or null. */
    async workflow(tx: ScopedTx, id: string): Promise<WorkflowRecord | null> {
        const row = await tx.manager.findOne(AgentWorkflowEntity, { where: { workspaceId: tx.workspaceId, id } })
        return row === null ? null : workflowRecordOf(row)
    }

    /** The workflows of an agent (all of the workspace when null), by agent and position, at most `limit`. */
    async workflows(tx: ScopedTx, agentId: string | null, limit: number): Promise<ReadonlyArray<WorkflowRecord>> {
        const rows = await tx.manager.find(AgentWorkflowEntity, {
            where: { workspaceId: tx.workspaceId, ...(agentId === null ? {} : { agentId }) },
            order: { agentId: "ASC", position: "ASC", id: "ASC" },
            take: limit,
        })
        return rows.map((item) => workflowRecordOf(item))
    }

    /** Writes a workflow unless its agent already holds that key: the row, or null when the key was taken. */
    async insertWorkflow(tx: ScopedTx, workflow: WorkflowInsert): Promise<WorkflowRecord | null> {
        const result = await tx.manager
            .createQueryBuilder()
            .insert()
            .into(AgentWorkflowEntity)
            .values({ workspaceId: tx.workspaceId, ...workflow })
            .orIgnore()
            .returning(["id"])
            .execute()
        if (!insertedOf(result.raw)) return null
        const row = await tx.manager.findOne(AgentWorkflowEntity, {
            where: { workspaceId: tx.workspaceId, agentId: workflow.agentId, key: workflow.key },
        })
        return row === null ? null : workflowRecordOf(row)
    }

    /** Applies a patch when `fence` still matches the stored version number and raises it by one: the new row, or null when the fence moved. */
    async updateWorkflow(tx: ScopedTx, id: string, fence: string, patch: WorkflowPatch): Promise<WorkflowRecord | null> {
        const result = await tx.manager
            .createQueryBuilder()
            .update(AgentWorkflowEntity)
            .set({ ...workflowColumnsOf(patch), version: () => "version + 1" })
            .where({ workspaceId: tx.workspaceId, id, version: Number(fence) })
            .execute()
        return (result.affected ?? 0) > 0 ? this.workflow(tx, id) : null
    }

    /** One workflow version by id, or null. */
    async version(tx: ScopedTx, id: string): Promise<WorkflowVersionRecord | null> {
        const row = await tx.manager.findOne(AgentWorkflowVersionEntity, { where: { workspaceId: tx.workspaceId, id } })
        return row === null ? null : workflowVersionRecordOf(row)
    }

    /** The versions of a workflow, newest first, at most `limit`. */
    async versions(tx: ScopedTx, workflowId: string, limit: number): Promise<ReadonlyArray<WorkflowVersionRecord>> {
        const rows = await tx.manager.find(AgentWorkflowVersionEntity, {
            where: { workspaceId: tx.workspaceId, workflowId },
            order: { number: "DESC", id: "DESC" },
            take: limit,
        })
        return rows.map((item) => workflowVersionRecordOf(item))
    }

    /** The workflow version written for one graph version of an agent, or null. */
    async versionOfGraphVersion(
        tx: ScopedTx,
        agentId: string,
        graphVersionId: string,
    ): Promise<WorkflowVersionRecord | null> {
        const row = await tx.manager.findOne(AgentWorkflowVersionEntity, {
            where: { workspaceId: tx.workspaceId, agentId, graphVersionId },
            order: { id: "ASC" },
        })
        return row === null ? null : workflowVersionRecordOf(row)
    }

    /** Writes the next version of a workflow: the row, or null when that number is already written. */
    async addVersion(tx: ScopedTx, version: WorkflowVersionInsert): Promise<WorkflowVersionRecord | null> {
        const { publishedAt, document, ...columns } = version
        const result = await tx.manager
            .createQueryBuilder()
            .insert()
            .into(AgentWorkflowVersionEntity)
            .values({
                workspaceId: tx.workspaceId,
                ...columns,
                document: structuredClone({ ...document }),
                ...(publishedAt === undefined ? {} : { publishedAt: new Date(publishedAt) }),
            })
            .orIgnore()
            .returning(["id"])
            .execute()
        if (!insertedOf(result.raw)) return null
        const row = await tx.manager.findOne(AgentWorkflowVersionEntity, {
            where: { workspaceId: tx.workspaceId, workflowId: version.workflowId, number: version.number },
        })
        return row === null ? null : workflowVersionRecordOf(row)
    }
}
