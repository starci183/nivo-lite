import { Query } from "@nestjs/cqrs"
import type { LeadJourneyData } from "@modules/domain/lead-views"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { LeadJourneyRequest } from "./lead-journey.contracts"

/** Asks for one lead's journey within the selected workspace. */
export class LeadJourneyQuery extends Query<LeadJourneyData> {
    constructor(readonly params: ExecuteParams<LeadJourneyRequest>) {
        super()
    }
}
