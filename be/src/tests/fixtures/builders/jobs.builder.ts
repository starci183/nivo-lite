import { FakeClock, mock } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import { JobClaimService, JobRunnerService, JobsLogEvent } from "@modules/platform/jobs"
import type { Logger } from "@modules/platform/logging"
import type { QueueDelivery, QueueWorkerRegistry } from "@modules/platform/queue"
import { CONTENT_TICK_QUEUE } from "@modules/queues/content-tick"
import type { EntityManager } from "typeorm"
const LEASE_MS = 100

/** Builds real claim/runner collaborators; claiming persists the scenario job through its public owner API. */
export const jobsBuilder = (manager: EntityManager, key: string) => {
    const delivery: QueueDelivery = {
        id: key,
        queue: CONTENT_TICK_QUEUE,
        job: CONTENT_TICK_QUEUE,
        payload: { id: "order-1" },
        attempt: 1,
        signal: new AbortController().signal,
    }
    const clock = new FakeClock("2026-10-14T00:00:00.000Z")
    const claims = new JobClaimService([manager], clock)
    const successorClaims = new JobClaimService([manager], clock)
    const logger = mock<Logger>()
    const runner = new JobRunnerService(
        { connection: PRIMARY_ENTITY_MANAGER, workerId: "worker-1", leaseMs: LEASE_MS, scheduler: { enabled: false } },
        claims,
        mock<QueueWorkerRegistry>(),
        logger,
    )
    const claim = (worker: JobClaimService, workerId: string) =>
        worker.claim({
            kind: delivery.queue,
            jobKey: delivery.id,
            payload: delivery.payload,
            workerId,
            leaseMs: LEASE_MS,
        })
    return { clock, claims, successorClaims, logger, runner, claim, delivery, fencedOutEvent: JobsLogEvent.FencedOut }
}
