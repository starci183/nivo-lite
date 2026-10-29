import { InjectQueueTimeout } from "@modules/platform/queue"
import type { QueueTimeout } from "@modules/platform/queue"
import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LivenessError, LivenessErrorCode } from "./errors/liveness.error"
import type { ReadinessReport } from "./readiness.contracts"
import { ReadinessLogEvent } from "./readiness.log-events"

/** The jobs statistics function result: one column named after the function, null when it returned no check. */
interface ReadinessJobsRow {
    /** The part of the statistics readiness requires; `checkedAt` is the database check timestamp. */
    readonly job_stats: { readonly checkedAt?: string | null } | null
}

const PROBE_TIMEOUT_MS = 3000

/** Releases the deadline timers of one readiness check. */
const release = (cancels: ReadonlyArray<() => void>): void => {
    for (const cancel of cancels) cancel()
}

@Injectable()
/** Checks the primary database and jobs together before the API accepts traffic. */
export class ReadinessService {
    /** Captures the primary connection and logger without probing dependencies at construction. */
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        @InjectQueueTimeout() private readonly timeout: QueueTimeout,
    ) {}

    /** Reports ready only when both dependency probes answer within three seconds. */
    async check(): Promise<ReadinessReport> {
        // The executor runs synchronously, so the deadline timer is registered before the probes start.
        const cancels: Array<() => void> = []
        const deadline = new Promise<never>((_resolve, reject) => {
            cancels.push(
                this.timeout.schedule(
                    () => reject(new LivenessError({ code: LivenessErrorCode.ReadinessUnavailable })),
                    PROBE_TIMEOUT_MS,
                ),
            )
        })
        try {
            const [, rows] = await Promise.race([
                Promise.all([
                    this.entityManager
                        .createQueryBuilder()
                        .select("1", "ready")
                        .from("information_schema.schemata", "s")
                        .limit(1)
                        .getRawOne<{ ready: number }>(),
                    callDbFunction<ReadinessJobsRow>(this.entityManager, "public.job_stats", []),
                ]),
                deadline,
            ])
            if (rows[0]?.job_stats?.checkedAt == null) {
                throw new LivenessError({ code: LivenessErrorCode.ReadinessUnavailable })
            }
            release(cancels)
            return { status: "ready", checks: { database: "ok", jobs: "ok" } }
        } catch (cause) {
            release(cancels)
            this.logger.error(ReadinessLogEvent.CheckFailed, cause)
            throw new LivenessError({ code: LivenessErrorCode.ReadinessUnavailable, cause })
        }
    }
}
