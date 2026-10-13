import { Injectable } from "@nestjs/common"
import type { LeadGenFlow } from "./work-engine.port"

@Injectable()
/** The lead generation flow of an app whose leads lane has not landed: no step follows a finished item. */
export class UnboundLeadGenFlowService implements LeadGenFlow {
    /** Continues nothing. */
    continueAfter(): Promise<void> {
        return Promise.resolve()
    }
}
