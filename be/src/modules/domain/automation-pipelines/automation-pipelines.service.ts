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
import { AutomationPipelineEntity } from "./persistence/entities"

/** The most pipelines one list holds. */
const ENABLED_LIMIT = 5000

/** The most pipelines one workspace is read for. */
const KEYS_LIMIT = 500

const toRow = (entity: AutomationPipelineEntity): PipelineRow => ({
    id: entity.id,
    workspace_id: entity.workspaceId,
    template_key: entity.templateKey,
    name: entity.name,
    module_key: entity.moduleKey,
    enabled: entity.enabled,
    dismissed: entity.dismissed,
    config: entity.config,
    body: entity.body,
    body_version: entity.bodyVersion,
    template_version: entity.templateVersion,
    based_on_context: entity.basedOnContext,
    approval_streak: entity.approvalStreak,
    trust_offered_at: entity.trustOfferedAt === null ? null : entity.trustOfferedAt.toISOString(),
    auto_send: entity.autoSend,
    created_at: entity.createdAt.toISOString(),
    updated_at: entity.updatedAt.toISOString(),
})

/** The columns a repeated save overwrites on an existing pipeline. */
const UPSERT_COLUMNS = [
    "name",
    "module_key",
    "template_version",
    "enabled",
    "dismissed",
    "config",
    "body",
    "body_version",
    "based_on_context",
    "approval_streak",
    "trust_offered_at",
    "auto_send",
    "updated_at",
]

@Injectable()
/** The pipelines of public.automation_pipelines: one row per template per workspace. */
export class AutomationPipelinesService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The pipeline of a template in a workspace, or none before the first switch. */
    async findPipeline(workspaceId: string, templateKey: string): Promise<PipelineOrNone> {
        const row = await this.entityManager.findOne(AutomationPipelineEntity, { where: { workspaceId, templateKey } })
        return row === null ? null : toRow(row)
    }

    /** One pipeline by id, or none. */
    async findPipelineById(pipelineId: string): Promise<PipelineOrNone> {
        const row = await this.entityManager.findOne(AutomationPipelineEntity, { where: { id: pipelineId } })
        return row === null ? null : toRow(row)
    }

    /** The pipelines of every workspace that are on. */
    async enabledPipelines(): Promise<ReadonlyArray<PipelineRow>> {
        const rows = await this.entityManager.find(AutomationPipelineEntity, {
            where: { enabled: true },
            order: { createdAt: "ASC" },
            take: ENABLED_LIMIT,
        })
        return rows.map(toRow)
    }

    /** The pipelines of one workspace that are on. */
    async enabledPipelinesOf(workspaceId: string): Promise<ReadonlyArray<PipelineRow>> {
        const rows = await this.entityManager.find(AutomationPipelineEntity, {
            where: { enabled: true, workspaceId },
            order: { createdAt: "ASC" },
            take: ENABLED_LIMIT,
        })
        return rows.map(toRow)
    }

    /** The pipelines of one template that are on, in every workspace, oldest workspace id first, bounded. */
    async enabledOfTemplate(templateKey: string, limit: number): Promise<ReadonlyArray<PipelineRow>> {
        const rows = await this.entityManager.find(AutomationPipelineEntity, {
            where: { enabled: true, templateKey },
            order: { workspaceId: "ASC" },
            take: limit,
        })
        return rows.map(toRow)
    }

    /** The id and template key of every pipeline of a workspace. */
    async pipelineKeys(workspaceId: string): Promise<ReadonlyArray<PipelineKey>> {
        const rows = await this.entityManager.find(AutomationPipelineEntity, {
            select: { id: true, templateKey: true },
            where: { workspaceId },
            take: KEYS_LIMIT,
        })
        return rows.map((row) => ({ id: row.id, template_key: row.templateKey }))
    }

    /** Creates or replaces the pipeline of a template; the row answered is the stored one. */
    async savePipeline(
        workspaceId: string,
        userId: string,
        def: TemplateDefinition,
        write: PipelineWrite,
    ): Promise<PipelineRow> {
        await this.entityManager
            .createQueryBuilder(AutomationPipelineEntity, "ap")
            .insert()
            .values({
                workspaceId,
                templateKey: def.key,
                name: def.name.vi,
                moduleKey: def.moduleKey,
                templateVersion: def.version,
                createdBy: userId,
                enabled: write.enabled,
                dismissed: write.dismissed,
                config: write.config,
                body: write.body,
                bodyVersion: write.bodyVersion,
                basedOnContext: write.basedOnContext,
                approvalStreak: write.approvalStreak,
                trustOfferedAt: write.trustOfferedAt === null ? null : new Date(write.trustOfferedAt),
                autoSend: write.autoSend,
                updatedAt: () => "now()",
            })
            .orUpdate(UPSERT_COLUMNS, ["workspace_id", "template_key"])
            .execute()
        const stored = await this.findPipeline(workspaceId, def.key)
        if (stored === null) throw new AutomationPipelinesError({ code: AutomationPipelinesErrorCode.NotSaved })
        return stored
    }

    /** Records the trust ladder after a decision. */
    async saveLadder(pipelineId: string, streak: number, offeredAt: OptionalInstant): Promise<void> {
        await this.entityManager.update(
            AutomationPipelineEntity,
            { id: pipelineId },
            {
                approvalStreak: streak,
                trustOfferedAt: offeredAt === null ? null : new Date(offeredAt),
                updatedAt: () => "now()",
            },
        )
    }
}
