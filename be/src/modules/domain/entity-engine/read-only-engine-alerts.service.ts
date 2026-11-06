import { Injectable } from "@nestjs/common"
import type { ParkedFlowAlert } from "@modules/platform/jobs"
import type { EngineFailureAlerts } from "./entity-engine.contracts"
import { EntityEngineError, EntityEngineErrorCode } from "./errors/entity-engine.error"

@Injectable()
/** The alerts of a process that only reads records (the MCP app): it runs no declared job, so a park there is a wiring error and fails loudly. */
export class ReadOnlyEngineAlertsService implements EngineFailureAlerts {
    /** Refuses the alert: no job runs in this process. */
    raise(alert: ParkedFlowAlert): Promise<void> {
        return Promise.reject(
            new EntityEngineError({ code: EntityEngineErrorCode.Unavailable, params: { job: alert.flowKind } }),
        )
    }
}
