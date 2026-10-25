import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import { PUBLISH_PRIVATE_BROADCAST } from "./persistence/realtime.sql"
import type { PrivateBroadcast } from "./realtime.contracts"
import type { RealtimePublisher } from "./realtime.port"

@Injectable()
/** Publishes backend events through Supabase Realtime; browser writers have no corresponding privilege. */
export class RealtimeService implements RealtimePublisher {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** Broadcasts after the calling domain has authorized its topic and authored the payload. */
    async publishPrivate(message: PrivateBroadcast): Promise<void> {
        await this.entityManager.query(PUBLISH_PRIVATE_BROADCAST, [
            message.topic,
            message.event,
            JSON.stringify(message.payload),
        ])
    }
}
