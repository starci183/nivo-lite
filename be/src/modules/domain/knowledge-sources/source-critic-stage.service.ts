import { Injectable } from "@nestjs/common"
import { IsNull } from "typeorm"
import type { EntityManager, FindOptionsWhere } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { eachInOrder } from "@modules/platform/primitives"
import { KnowledgeProgressService } from "./knowledge-progress.service"
import { KnowledgeSourcesLogEvent } from "./knowledge-sources.log-events"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { NOW } from "./source-input.policy"

/** The most documents one end of a run lets go. */
const WAITING_MAX = 500

@Injectable()
/**
 * The fourth step of taking a document in. A document whose facts are read stays `ready`; while the critic checks its dossier it wears the
 * stage `critic`, so the processing list lights the step, and the stage goes when the critic's run for that document ends, done, failed or
 * skipped. Neither call ever fails the run that makes it: a stage that could not be written is logged, and the next stream converges.
 */
export class SourceCriticStageService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        private readonly progress: KnowledgeProgressService,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** The critic's run for this document is queued: a ready document with no stage wears `critic` and every member is told. */
    async enter(workspaceId: string, sourceId: string): Promise<void> {
        await this.move(workspaceId, sourceId, { status: "ready", stage: IsNull() }, "critic")
    }

    /** The critic's run for this document ended in any way: the stage goes, only when it is still `critic`, so a reindex that began meanwhile keeps its own stage. */
    async leave(workspaceId: string, sourceId: string): Promise<void> {
        await this.move(workspaceId, sourceId, { stage: "critic" }, null)
    }

    /** The last run of the workspace ended: no document waits on the critic any more, so every document still wearing the stage leaves it. */
    async leaveAll(workspaceId: string): Promise<void> {
        try {
            const waiting = await this.entityManager.find(KnowledgeSourceEntity, {
                select: { id: true },
                where: { workspaceId, stage: "critic" },
                take: WAITING_MAX,
            })
            await eachInOrder(waiting, (source) => this.leave(workspaceId, source.id))
        } catch (cause) {
            this.logger.error(KnowledgeSourcesLogEvent.ProgressFailed, cause, { workspaceId })
        }
    }

    /** Writes the stage of the source where it still stands as `from` says, then announces the row when one changed. */
    private async move(
        workspaceId: string,
        sourceId: string,
        from: FindOptionsWhere<KnowledgeSourceEntity>,
        stage: "critic" | null,
    ): Promise<void> {
        try {
            const moved = await this.entityManager.update(
                KnowledgeSourceEntity,
                { id: sourceId, workspaceId, ...from },
                { stage, updatedAt: NOW },
            )
            if ((moved.affected ?? 0) > 0) await this.progress.announce(workspaceId, sourceId)
        } catch (cause) {
            this.logger.error(KnowledgeSourcesLogEvent.ProgressFailed, cause, { sourceId })
        }
    }
}
