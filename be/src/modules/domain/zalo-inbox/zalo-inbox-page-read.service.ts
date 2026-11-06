import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalZaloInboxFacts, ZaloInboxFactsRow } from "./zalo-inbox.contracts"
import { ZaloInboxEntity } from "./persistence/entities"

/** The webhook body test for one event name, as the inbox stores the raw body. */
const eventNamed = (event: string): string =>
    `i.payload->>'rawBody' ~ '"event_name"[[:space:]]*:[[:space:]]*"${event}"'`

@Injectable()
/** What the Zalo OA page reads from the inbox: the facts of one connection. */
export class ZaloInboxPageReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** When the latest event arrived and whether a customer text and a follow event were seen; null when the inbox has no row of the connection. */
    factsOf(connectionId: string): Promise<OptionalZaloInboxFacts> {
        return this.entityManager
            .createQueryBuilder(ZaloInboxEntity, "i")
            .select("max(i.received_at)::text", "last_at")
            .addSelect(`coalesce(bool_or(${eventNamed("user_send_text")}), false)`, "has_text")
            .addSelect(`coalesce(bool_or(${eventNamed("follow")}), false)`, "has_follow")
            .where("i.payload->>'connection' = :connectionId", { connectionId })
            .getRawMany<ZaloInboxFactsRow>()
            .then((rows) => rows[0] ?? null)
    }
}
