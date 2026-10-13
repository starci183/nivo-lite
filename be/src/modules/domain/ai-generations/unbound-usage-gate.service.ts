import { Injectable } from "@nestjs/common"
import type { OptionalQuotaBlock, UsageGate } from "./ai-generations.port"

@Injectable()
/** The usage gate of an app whose billing lane has not landed: no plan blocks a text and no usage is metered. */
export class UnboundUsageGateService implements UsageGate {
    /** Nothing is blocked. */
    blockedBy(): Promise<OptionalQuotaBlock> {
        return Promise.resolve(null)
    }

    /** Nothing is metered. */
    record(): Promise<void> {
        return Promise.resolve()
    }
}
