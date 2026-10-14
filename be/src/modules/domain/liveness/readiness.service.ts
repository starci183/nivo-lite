import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { LivenessError, LivenessErrorCode } from "./errors/liveness.error"
import type { ReadinessJobsRow } from "./persistence/readiness.rows"
import { CHECK_READINESS_DATABASE, CHECK_READINESS_JOBS } from "./persistence/readiness.sql"
import type { ReadinessReport } from "./readiness.contracts"
import { ReadinessLogEvent } from "./readiness.log-events"

const PROBE_TIMEOUT_MS = 3000

@Injectable()
/** Checks the primary database and jobs together before the API accepts traffic. */
export class ReadinessService {
    /** Captures the primary connection and logger without probing dependencies at construction. */
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Reports ready only when both dependency probes answer within three seconds. */
    async check(): Promise<ReadinessReport> {
        const cleanup = new AbortController()
        const signal = AbortSignal.timeout(PROBE_TIMEOUT_MS)
        const deadline = new Promise<never>((_resolve, reject) => {
            signal.addEventListener(
                "abort",
                () => reject(new LivenessError({ code: LivenessErrorCode.ReadinessUnavailable })),
                { once: true, signal: cleanup.signal },
            )
        })
        try {
            const [, rows] = await Promise.race([
                Promise.all([
                    this.entityManager.query<unknown>(CHECK_READINESS_DATABASE),
                    this.entityManager.query<Array<ReadinessJobsRow>>(CHECK_READINESS_JOBS),
                ]),
                deadline,
            ])
            if (rows[0]?.stats?.checkedAt == null) {
                throw new LivenessError({ code: LivenessErrorCode.ReadinessUnavailable })
            }
            return { status: "ready", checks: { database: "ok", jobs: "ok" } }
        } catch (cause) {
            this.logger.error(ReadinessLogEvent.CheckFailed, cause)
            throw new LivenessError({ code: LivenessErrorCode.ReadinessUnavailable, cause })
        } finally {
            cleanup.abort()
        }
    }
}
