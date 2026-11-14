import {
    JobClaimService,
    JobRenewalService,
    JobRunnerService,
    JobsLogEvent,
    type JobClaimResult,
} from "@modules/platform/jobs"
import { FakeClock, mock, type MockOf } from "@starci/jest-preset"
import { PRIMARY_ENTITY_MANAGER } from "@modules/platform/database"
import type { Logger } from "@modules/platform/logging"
import type { QueueDelivery, QueueWorkerRegistry } from "@modules/platform/queue"
import type { Timer } from "@modules/platform/retry"
import { CONNECTION_HEALTH_QUEUE } from "@modules/queues/connection-health"
import type { EntityManager } from "typeorm"
const LEASE_MS = 100
/** Cancels a timer that never runs. */
const NO_CANCEL = (): void => undefined

type JobsBuilderResultShape = {
    clock: FakeClock
    claims: JobClaimService
    successorClaims: JobClaimService
    logger: MockOf<Logger>
    runner: JobRunnerService
    claim: (worker: JobClaimService, workerId: string) => Promise<JobClaimResult>
    delivery: QueueDelivery
    fencedOutEvent: JobsLogEvent
}

/** Builds real claim/runner collaborators; claiming persists the scenario job through its public owner API. */
export const jobsBuilder = (manager: EntityManager, key: string): JobsBuilderResultShape => {
    const delivery: QueueDelivery = {
        id: key,
        queue: CONNECTION_HEALTH_QUEUE,
        job: CONNECTION_HEALTH_QUEUE,
        payload: { id: "order-1" },
        attempt: 1,
        signal: new AbortController().signal,
    }
    const clock = new FakeClock("2026-10-14T00:00:00.000Z")
    const claims = new JobClaimService([manager], clock)
    const successorClaims = new JobClaimService([manager], clock)
    const logger = mock<Logger>()
    const options = {
        connection: PRIMARY_ENTITY_MANAGER,
        workerId: "worker-1",
        leaseMs: LEASE_MS,
        scheduler: { enabled: false },
    }
    const idle: Timer = { schedule: () => NO_CANCEL }
    const runner = new JobRunnerService(
        options,
        claims,
        mock<QueueWorkerRegistry>(),
        logger,
        new JobRenewalService(options, claims, idle, logger),
    )
    const claim = (worker: JobClaimService, workerId: string): Promise<JobClaimResult> =>
        worker.claim({
            kind: delivery.queue,
            jobKey: delivery.id,
            payload: delivery.payload,
            workerId,
            leaseMs: LEASE_MS,
        })
    return { clock, claims, successorClaims, logger, runner, claim, delivery, fencedOutEvent: JobsLogEvent.FencedOut }
}
