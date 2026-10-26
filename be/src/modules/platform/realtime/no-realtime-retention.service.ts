import { Injectable } from "@nestjs/common"
import type { RealtimeRetention } from "./realtime-retention.port"

@Injectable()
/** The retention of a hub that keeps no replay table (the memory and Redis hubs bound their own frames): a scheduled tick finds nothing to sweep. */
export class NoRealtimeRetentionService implements RealtimeRetention {
    /** Deletes nothing; the tick is acknowledged and the queue does not pile up. */
    sweep(): Promise<number> {
        return Promise.resolve(0)
    }
}
