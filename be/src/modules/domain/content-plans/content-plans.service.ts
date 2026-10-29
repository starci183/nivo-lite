import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ContentAiStoreService, ContentEditorService } from "@modules/domain/content-items"
import type { ContentGeneratedPlan, ContentWorkbench, OptionalPlanSummary } from "@modules/domain/content-items"
import { advisoryXactLock, InjectPrimaryEntityManager } from "@modules/platform/database"
import { ContentPlansError, ContentPlansErrorCode } from "./errors/content-plans.error"
import type { ContentPlanApplied } from "./content-plans.contracts"
import { ContentPlanEntity } from "./persistence/entities"

@Injectable()
/** The content_plans table owner, applying a plan and its ideas together. */
export class ContentPlansService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly items: ContentAiStoreService,
        private readonly editor: ContentEditorService,
    ) {}

    /** Saves the plan and delegates item writes within the caller's transaction. */
    apply(workspaceId: string, plan: ContentGeneratedPlan, tx?: EntityManager): Promise<ContentPlanApplied> {
        const save = async (manager: EntityManager): Promise<ContentPlanApplied> => {
            await advisoryXactLock(manager, workspaceId)
            const inserted = await manager.insert(ContentPlanEntity, {
                workspaceId,
                month: `${plan.month.slice(0, 7)}-01`,
                status: "done",
                ideaCount: plan.items.length,
                aiMs: plan.aiMs,
                meta: { ...plan.meta, generation_id: plan.generationId },
                createdBy: plan.actor,
            })
            const planId = inserted.identifiers.map((identifier) => String(identifier.id)).join("")
            if (planId === "") throw new ContentPlansError({ code: ContentPlansErrorCode.NotWritten })
            const ideas = await this.items.insertPlannedIdeas(workspaceId, planId, plan, manager)
            return { planId, ideas }
        }
        return tx === undefined ? this.entityManager.transaction(save) : save(tx)
    }

    /** The content page for a member: the editor's data with the newest completed plan this capability owns. */
    workbench(userId: string, workspaceId: string): Promise<ContentWorkbench> {
        return this.editor.workbench(userId, workspaceId, (id) => this.last(id))
    }

    /** The newest completed editorial plan of the workspace, or nothing before the first. */
    last(workspaceId: string): Promise<OptionalPlanSummary> {
        return this.entityManager
            .createQueryBuilder(ContentPlanEntity, "pl")
            .select("pl.month", "month")
            .addSelect("pl.idea_count", "ideas")
            .addSelect("pl.ai_ms", "ms")
            .addSelect("pl.created_at", "createdAt")
            .where("pl.workspace_id = :workspaceId AND pl.status = 'done'", { workspaceId })
            .orderBy("pl.created_at", "DESC")
            .limit(1)
            .getRawOne<NonNullable<OptionalPlanSummary>>()
    }
}
