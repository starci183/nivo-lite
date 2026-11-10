import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectAi } from "@modules/integrations/ai"
import type { AiService } from "@modules/integrations/ai"
import { callDbFunction, InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
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
/**
 * Checks what the process cannot work without before it accepts traffic: the primary database (through the jobs statistics function)
 * and the AI endpoint. The process boots without `AI_BASE_URL` / `STARCI_AI_KEY`, but it is never ready: every model call would fail.
 */
export class ReadinessService {
    /** Captures the primary connection and logger without probing dependencies at construction. */
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
        @InjectTimer() private readonly timer: Timer,
        @InjectAi() private readonly ai: AiService,
    ) {}

    /** Reports ready only when the AI endpoint is configured and both database probes answer within three seconds. */
    async check(): Promise<ReadinessReport> {
        // The executor runs synchronously, so the deadline timer is registered before the probes start.
        const cancels: Array<() => void> = []
        const deadline = new Promise<never>((_resolve, reject) => {
            cancels.push(
                this.timer.schedule(
                    () => reject(new LivenessError({ code: LivenessErrorCode.ReadinessUnavailable })),
                    PROBE_TIMEOUT_MS,
                ),
            )
        })
        try {
            const rows = await Promise.race([
                this.entityManager.transaction((manager) =>
                    callDbFunction<ReadinessJobsRow>(manager, "public.job_stats", []),
                ),
                deadline,
            ])
            if (rows[0]?.job_stats?.checkedAt == null) {
                throw new LivenessError({ code: LivenessErrorCode.ReadinessUnavailable })
            }
            if (!this.ai.available()) {
                this.logger.error(ReadinessLogEvent.AiUnconfigured, null)
                throw new LivenessError({ code: LivenessErrorCode.ReadinessUnavailable })
            }
            release(cancels)
            return { status: "ready", checks: { database: "ok", jobs: "ok", ai: "ok" } }
        } catch (cause) {
            release(cancels)
            this.logger.error(ReadinessLogEvent.CheckFailed, cause)
            throw new LivenessError({ code: LivenessErrorCode.ReadinessUnavailable, cause })
        }
    }
}
