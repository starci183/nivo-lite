import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { ContentAiStoreService } from "@modules/domain/content-items"
import type { ContentGeneratedPlan } from "@modules/domain/content-items"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { ContentPlansError, ContentPlansErrorCode } from "./errors/content-plans.error"
import type { ContentPlanApplied } from "./content-plans.contracts"
import { INSERT_CONTENT_PLAN, LOCK_CONTENT_PLAN } from "./persistence/content-plans.sql"

@Injectable()
/** The content_plans table owner, applying a plan and its ideas together. */
export class ContentPlansService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly items: ContentAiStoreService,
    ) {}

    /** Saves the plan and delegates item writes within the caller's transaction. */
    apply(workspaceId: string, plan: ContentGeneratedPlan, tx?: EntityManager): Promise<ContentPlanApplied> {
        const save = async (manager: EntityManager): Promise<ContentPlanApplied> => {
            await manager.query(LOCK_CONTENT_PLAN, [workspaceId])
            const [row] = await manager.query<Array<{ id: string }>>(INSERT_CONTENT_PLAN, [
                workspaceId,
                `${plan.month.slice(0, 7)}-01`,
                plan.items.length,
                plan.aiMs,
                JSON.stringify({ ...plan.meta, generation_id: plan.generationId }),
                plan.actor,
            ])
            if (row === undefined) throw new ContentPlansError({ code: ContentPlansErrorCode.NotWritten })
            const ideas = await this.items.insertPlannedIdeas(workspaceId, row.id, plan, manager)
            return { planId: row.id, ideas }
        }
        return tx === undefined ? this.entityManager.transaction(save) : save(tx)
    }
}
