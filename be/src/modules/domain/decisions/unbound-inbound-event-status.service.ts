import { Injectable } from "@nestjs/common"
import type { InboundEventStatus } from "./work-engine.port"

@Injectable()
/** The inbound event status of an app whose inbox lane has not landed: there is no event to mark. */
export class UnboundInboundEventStatusService implements InboundEventStatus {
    /** Marks nothing. */
    mark(): Promise<void> {
        return Promise.resolve()
    }
}
