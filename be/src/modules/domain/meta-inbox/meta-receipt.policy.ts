import { Injectable } from "@nestjs/common"
import { parseWebhook, type MetaEvent } from "@modules/integrations/meta"
import { InjectClock, type Clock } from "@modules/platform/clock"

@Injectable()
/** Parses a locked receipt locally, without calling the provider. */
export class MetaReceiptPolicy {
    constructor(@InjectClock() private readonly clock: Clock) {}

    /** Normalises events using the application's clock for omitted provider timestamps. */
    parse(body: unknown): Array<MetaEvent> {
        return parseWebhook(body, this.clock.now().getTime())
    }
}
