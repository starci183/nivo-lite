import { Injectable } from "@nestjs/common"
import { In } from "typeorm"
import type { EntityManager } from "typeorm"
import { SourceCriticStageService } from "@modules/domain/knowledge-sources"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { DossierReviewRunEntity } from "./persistence/entities"

@Injectable()
/**
 * Tells the fourth step of taking a document in when the critic is done with it. A run covers every document asked for while it was
 * queued, so when a run ends, or its claim finds it ended, the document it was asked for stops waiting, and when no other run of the
 * workspace is queued or going, no document waits on the critic any more.
 */
export class ReviewCriticService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly stage: SourceCriticStageService,
    ) {}

    /** The run ended in any way (done, failed for good, or found already ended): the documents it covered stop waiting. Answers whom it let go: every document, the one the run was asked for, or none. */
    async settle(workspaceId: string, runId: string): Promise<"all" | "one" | "none"> {
        const run = await this.entityManager.findOne(DossierReviewRunEntity, {
            select: { id: true, trigger: true, triggerRef: true },
            where: { id: runId, workspaceId },
        })
        const pending = await this.entityManager.exists(DossierReviewRunEntity, {
            where: { workspaceId, status: In(["queued", "running"]) },
        })
        if (!pending) {
            await this.stage.leaveAll(workspaceId)
            return "all"
        }
        if (run?.trigger !== "document" || run.triggerRef === null) return "none"
        await this.stage.leave(workspaceId, run.triggerRef)
        return "one"
    }
}
