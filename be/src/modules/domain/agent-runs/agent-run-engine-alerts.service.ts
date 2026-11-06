import { Injectable } from "@nestjs/common"
import type { EngineFailureAlerts } from "@modules/domain/entity-engine"
import type { ParkedFlowAlert } from "@modules/platform/jobs"
import { AgentRunAlertsService } from "./agent-run-alerts.service"

@Injectable()
/** Tells the owner of a job the entity engine parked through the same alerts a parked agent run uses; the app root binds it to the engine. */
export class AgentRunEngineAlertsService implements EngineFailureAlerts {
    constructor(private readonly alerts: AgentRunAlertsService) {}

    /** Tells every registered alert. */
    raise(alert: ParkedFlowAlert): Promise<void> {
        return this.alerts.raise(alert)
    }
}
