import { Injectable } from "@nestjs/common"
import type { DecisionEvents } from "./work-engine.port"

@Injectable()
/** The outbound decision events of an app whose automations lane has not landed. */
export class UnboundDecisionEventsService implements DecisionEvents {
    /** Emits nothing. */
    decisionMade(): Promise<void> {
        return Promise.resolve()
    }
}
