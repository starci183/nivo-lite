import { Injectable } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import { InjectPrimaryEntityManager } from "@modules/platform/database"
import type { OptionalZaloInboxFacts, ZaloFollowEventRow, ZaloInboxFactsRow } from "./zalo-inbox.contracts"
import { ZaloInboxEntity } from "./persistence/entities"

/** The most follow events a page reads. */
const FOLLOW_LIMIT = 20

/** The webhook body test for one event name, as the inbox stores the raw body. */
const eventNamed = (event: string): string =>
    `i.payload->>'rawBody' ~ '"event_name"[[:space:]]*:[[:space:]]*"${event}"'`

@Injectable()
/** What the Zalo OA page reads from the inbox: the follow events and the facts of one connection. */
export class ZaloInboxPageReadService {
    constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}

    /** The newest follow events of a connection, newest first, at most twenty. */
    followEvents(connectionId: string): Promise<Array<ZaloFollowEventRow>> {
        return this.entityManager
            .createQueryBuilder(ZaloInboxEntity, "i")
            .select("i.id", "id")
            .addSelect("i.received_at::text", "received_at")
            .where("i.payload->>'connection' = :connectionId", { connectionId })
            .andWhere(eventNamed("follow"))
            .orderBy("i.received_at", "DESC")
            .limit(FOLLOW_LIMIT)
            .getRawMany<ZaloFollowEventRow>()
    }

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
