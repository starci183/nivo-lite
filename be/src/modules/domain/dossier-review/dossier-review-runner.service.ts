import { Injectable } from "@nestjs/common"
import { In, type EntityManager } from "typeorm"
import { InjectClock, type Clock } from "@modules/platform/clock"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger, type Logger } from "@modules/platform/logging"
import { isDossierReviewPayload } from "@modules/queues/knowledge"
import { DOSSIER_REVIEW_CAPS, JOB_FAILED, type JobOutcome } from "./dossier-review.contracts"
import { DossierReviewLogEvent } from "./dossier-review.log-events"
import { DocumentCriticService } from "./document-critic.service"
import { DossierReviewRunsService } from "./dossier-review-runs.service"
import { DossierReviewRunEntity } from "./persistence/entities"
import { ReviewCriticService } from "./review-critic.service"

@Injectable()
/** Carries out a run: claims it, runs one batch of the shop-document critiques that wait, ends the run and lets its documents go on. */
export class DossierReviewRunnerService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectClock() private readonly clock: Clock,
        @InjectLogger() private readonly logger: Logger,
        private readonly critic: ReviewCriticService,
        private readonly documentCritic: DocumentCriticService,
        private readonly runs: DossierReviewRunsService,
    ) {}

    /** Runs the run a job names; a payload of another shape, or a run another worker holds or finished, changes nothing. */
    async run(payload: object): Promise<JobOutcome> {
        if (!isDossierReviewPayload(payload)) {
            this.logger.warn(DossierReviewLogEvent.PayloadRefused, { job: "review" })
            return "skipped"
        }
        const now = this.clock.now()
        const run = await this.claim(payload.workspaceId, payload.runId, now)
        if (run === null) {
            await this.critic.settle(payload.workspaceId, payload.runId)
            return "skipped"
        }
        await this.entityManager.update(
            DossierReviewRunEntity,
            { id: run.id, workspaceId: run.workspaceId },
            { status: "done", finishedAt: now },
        )
        // The shop-document critic of every document waiting for it, before the documents leave the `critic` stage; it never throws.
        await this.critiques(run.workspaceId)
        await this.critic.settle(run.workspaceId, run.id)
        return "done"
    }

    /** The job of a run failed for good: the run, while queued or running, ends failed; the documents waiting for the critic still get it. */
    async fail(payload: object): Promise<void> {
        if (!isDossierReviewPayload(payload)) return
        await this.entityManager.update(
            DossierReviewRunEntity,
            { id: payload.runId, workspaceId: payload.workspaceId, status: In(["queued", "running"]) },
            { status: "failed", finishedAt: this.clock.now(), error: JOB_FAILED },
        )
        await this.critiques(payload.workspaceId)
        await this.critic.settle(payload.workspaceId, payload.runId)
    }

    /**
     * The waiting shop-document critiques, one batch; when more wait than one run carries out, a follow-up run is queued. A critique that
     * ended a slice of its work with progress waits again behind the others (`DocumentCriticService.runWaiting`), so the follow-up serves
     * the workspace's other documents first, then comes back to it. The follow-up never spins: a critique that ended without progress is
     * `not_done`, not waiting, and a batch that ran nothing (every waiting critique skipped or not taken) queues no follow-up (the next
     * request or upkeep tick asks again).
     */
    private async critiques(workspaceId: string): Promise<void> {
        const ran = await this.documentCritic.runWaiting(workspaceId)
        if (ran > 0 && (await this.documentCritic.hasWaiting(workspaceId))) await this.runs.continueCritiques(workspaceId)
    }

    /** Takes a queued run, or one whose worker has been silent for 15 minutes; null when another worker holds it or it ended. */
    private claim(workspaceId: string, runId: string, now: Date): Promise<DossierReviewRunEntity | null> {
        return this.entityManager.transaction(async (tx) => {
            const row = await tx.findOne(DossierReviewRunEntity, {
                where: { id: runId, workspaceId },
                lock: { mode: "pessimistic_write" },
            })
            if (row === null) return null
            const staleBefore = now.getTime() - DOSSIER_REVIEW_CAPS.staleRunMinutes * 60_000
            const stale = row.status === "running" && (row.startedAt?.getTime() ?? 0) < staleBefore
            if (row.status !== "queued" && !stale) return null
            await tx.update(DossierReviewRunEntity, { id: row.id, workspaceId }, { status: "running", startedAt: now })
            return row
        })
    }
}
