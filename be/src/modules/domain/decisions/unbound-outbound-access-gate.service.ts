import { Injectable } from "@nestjs/common"
import type { OutboundAccess } from "./work-engine.contracts"
import type { OutboundAccessGate } from "./work-engine.port"

@Injectable()
/** The outbound access gate of an app whose connections lane has not landed: nothing is bound, so the rule alone decides. */
export class UnboundOutboundAccessGateService implements OutboundAccessGate {
    /** Every item may run on the rule alone. */
    accessOf(): Promise<OutboundAccess> {
        return Promise.resolve("auto")
    }
}
