import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import type { TemplateDefinition } from "@modules/domain/automation-templates"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type {
    OptionalInstant,
    PipelineKey,
    PipelineOrNone,
    PipelineRow,
    PipelineWrite,
} from "./automation-pipelines.contracts"
import { AutomationPipelinesError, AutomationPipelinesErrorCode } from "./errors/automation-pipelines.error"
import {
    SELECT_ENABLED_PIPELINES,
    SELECT_PIPELINE,
    SELECT_PIPELINE_BY_ID,
    SELECT_PIPELINE_KEYS,
    UPDATE_PIPELINE_LADDER,
    UPSERT_PIPELINE,
} from "./persistence/automation-pipelines.sql"

@Injectable()
/** The pipelines of public.automation_pipelines: one row per template per workspace. */
export class AutomationPipelinesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The pipeline of a template in a workspace, or none before the first switch. */
    async findPipeline(workspaceId: string, templateKey: string): Promise<PipelineOrNone> {
        const [row] = await this.entityManager.query<Array<PipelineRow>>(SELECT_PIPELINE, [workspaceId, templateKey])
        return row ?? null
    }

    /** One pipeline by id, or none. */
    async findPipelineById(pipelineId: string): Promise<PipelineOrNone> {
        const [row] = await this.entityManager.query<Array<PipelineRow>>(SELECT_PIPELINE_BY_ID, [pipelineId])
        return row ?? null
    }

    /** The pipelines of every workspace that are on. */
    enabledPipelines(): Promise<ReadonlyArray<PipelineRow>> {
        return this.entityManager.query<Array<PipelineRow>>(SELECT_ENABLED_PIPELINES, [null])
    }

    /** The pipelines of one workspace that are on. */
    enabledPipelinesOf(workspaceId: string): Promise<ReadonlyArray<PipelineRow>> {
        return this.entityManager.query<Array<PipelineRow>>(SELECT_ENABLED_PIPELINES, [workspaceId])
    }

    /** The id and template key of every pipeline of a workspace. */
    pipelineKeys(workspaceId: string): Promise<ReadonlyArray<PipelineKey>> {
        return this.entityManager.query<Array<PipelineKey>>(SELECT_PIPELINE_KEYS, [workspaceId])
    }

    /** Creates or replaces the pipeline of a template; the row answered is the stored one. */
    async savePipeline(
        workspaceId: string,
        userId: string,
        def: TemplateDefinition,
        write: PipelineWrite,
    ): Promise<PipelineRow> {
        const [row] = await this.entityManager.query<Array<PipelineRow>>(UPSERT_PIPELINE, [
            workspaceId,
            def.key,
            def.name.vi,
            def.moduleKey,
            def.version,
            userId,
            write.enabled,
            write.dismissed,
            JSON.stringify(write.config),
            write.body,
            write.bodyVersion,
            write.basedOnContext,
            write.approvalStreak,
            write.trustOfferedAt,
            write.autoSend,
        ])
        if (row === undefined) throw new AutomationPipelinesError({ code: AutomationPipelinesErrorCode.NotSaved })
        return row
    }

    /** Records the trust ladder after a decision. */
    async saveLadder(pipelineId: string, streak: number, offeredAt: OptionalInstant): Promise<void> {
        await this.entityManager.query(UPDATE_PIPELINE_LADDER, [pipelineId, streak, offeredAt])
    }
}
