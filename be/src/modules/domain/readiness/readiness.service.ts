import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { InjectLogger } from "@modules/platform/logging"
import type { Logger } from "@modules/platform/logging"
import { startLocalTimeout } from "@modules/platform/queue"
import type { LocalTimer } from "@modules/platform/queue"
import { READ_DATABASE_PROBE } from "./persistence/readiness.sql"
import type { ReadinessReport } from "./readiness.contracts"
import { ReadinessLogEvent } from "./readiness.log-events"

const DATABASE_PROBE_TIMEOUT_MS = 2000

@Injectable()
/** Readiness of this instance: its required primary database must answer a read-only query within two seconds. */
export class ReadinessService {
    constructor(
        @InjectPrimaryEntityManager() private readonly entityManager: EntityManager,
        @InjectLogger() private readonly logger: Logger,
    ) {}

    /** Bounds the probe response and logs only fixed reasons, never a driver's message or connection details. */
    async check(): Promise<ReadinessReport> {
        let timeout: LocalTimer | undefined
        try {
            const answered = await Promise.race([
                this.entityManager.query(READ_DATABASE_PROBE).then(() => true),
                new Promise<boolean>((resolve) => {
                    timeout = startLocalTimeout(DATABASE_PROBE_TIMEOUT_MS, () => resolve(false))
                }),
            ])
            if (!answered) {
                this.logger.error(ReadinessLogEvent.DatabaseUnavailable, "The primary database probe timed out.", {
                    timeoutMs: DATABASE_PROBE_TIMEOUT_MS,
                })
                return { status: "unready", checks: { database: "down" } }
            }
            return { status: "ok", checks: { database: "ok" } }
        } catch {
            this.logger.error(ReadinessLogEvent.DatabaseUnavailable, "The primary database probe failed.", {
                timeoutMs: DATABASE_PROBE_TIMEOUT_MS,
            })
            return { status: "unready", checks: { database: "down" } }
        } finally {
            timeout?.cancel()
        }
    }
}
