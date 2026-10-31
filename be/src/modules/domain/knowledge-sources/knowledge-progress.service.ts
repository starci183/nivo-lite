import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { WorkspaceMemberSeatsService } from "@modules/domain/workspace-members"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectIds } from "@modules/platform/ids"
import type { Ids } from "@modules/platform/ids"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectRealtimeHub } from "@modules/platform/realtime"
import type { RealtimeHub } from "@modules/platform/realtime"
import type { ProgressChange } from "./knowledge-progress.contracts"
import { columnsOf, knowledgeProgressTopic, progressOfRow } from "./knowledge-progress.policy"
import { KnowledgeSourcesLogEvent } from "./knowledge-sources.log-events"
import { KnowledgeSourceEntity } from "./persistence/entities"
import { ProgressThrottlePolicy } from "./progress-throttle.policy"
import { NOW } from "./source-input.policy"

/** The most active members one push reaches. */
const MEMBER_LIMIT = 500

/** The columns a progress frame is built from. */
const PROGRESS_COLUMNS = {
    id: true,
    status: true,
    progress: true,
    stage: true,
    stageDone: true,
    stageTotal: true,
    error: true,
    chunkCount: true,
    updatedAt: true,
} as const

@Injectable()
/**
 * Where a worker writes the progress of a source: the row first, then one frame per active member of the workspace. A frame that
 * cannot be pushed is logged and never fails the work, because every client reads the stored state again when its stream opens.
 */
export class KnowledgeProgressService {
    private readonly throttle = new ProgressThrottlePolicy()

    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectRealtimeHub() private readonly hub: RealtimeHub,
        @InjectClock() private readonly clock: Clock,
        @InjectIds() private readonly ids: Ids,
        @InjectLogger() private readonly logger: Logger,
        private readonly seats: WorkspaceMemberSeatsService,
    ) {}

    /** Stores the change on the source row, then pushes the state the row holds. */
    async write(workspaceId: string, sourceId: string, change: ProgressChange): Promise<void> {
        await this.entityManager.update(
            KnowledgeSourceEntity,
            { id: sourceId, workspaceId },
            { ...columnsOf(change), updatedAt: NOW },
        )
        if (change.stage === null) this.throttle.release(sourceId)
        await this.announce(workspaceId, sourceId)
    }

    /** A running count of a stage: at most about one write a second per source goes out; it never fails the job. */
    async count(workspaceId: string, sourceId: string, change: ProgressChange): Promise<void> {
        if (!this.throttle.admits(sourceId, this.clock.now().getTime())) return
        await this.write(workspaceId, sourceId, change).catch((cause: unknown) => {
            this.logger.error(KnowledgeSourcesLogEvent.ProgressFailed, cause, { sourceId })
        })
    }

    /** Pushes the state the row of a source holds now (after the writer's own write committed) to every active member. */
    async announce(workspaceId: string, sourceId: string): Promise<void> {
        try {
            const row = await this.entityManager.findOne(KnowledgeSourceEntity, {
                select: PROGRESS_COLUMNS,
                where: { id: sourceId, workspaceId },
            })
            if (row === null) return
            const state = progressOfRow(row)
            const members = await this.seats.activeUsers(workspaceId, MEMBER_LIMIT)
            await Promise.all(
                members.map((member) =>
                    this.hub.publish(knowledgeProgressTopic(member.userId, workspaceId), {
                        ...state,
                        id: `progress:${this.ids.next()}`,
                        kind: "progress",
                    }),
                ),
            )
        } catch (cause) {
            this.logger.error(KnowledgeSourcesLogEvent.PublishFailed, cause, { sourceId })
        }
    }
}
