import { Injectable } from "@nestjs/common"
import { AccountDataReadService } from "@modules/domain/account-data"
import type { OptionalZaloInboxFacts, ZaloWriter } from "./zalo-inbox.contracts"
import { zaloEvent, zaloMessage, zaloUser } from "./zalo.data-types"
import { zaloFactsOf } from "./zalo-inbox-facts.policy"

/** The text form of a followed person's `followed` member, as the declared index compares it. */
const FOLLOWED = "true"

/** How many of the newest stored messages one look for recent writers reads (the store never answers more than this). */
const MESSAGES_LOOKED_AT = 200

/** The direction of a message the customer wrote. */
const INBOUND = "in"

@Injectable()
/** What the Zalo OA page reads of a connection: the facts of its account's events, messages and followers. */
export class ZaloInboxPageReadService {
    constructor(private readonly reads: AccountDataReadService) {}

    /** When the latest event or message arrived and whether a customer message and a follower are kept; null when the account keeps none. */
    async factsOf(connectionId: string): Promise<OptionalZaloInboxFacts> {
        const [event] = await this.reads.newest(connectionId, zaloEvent.name, 1)
        const [message] = await this.reads.newest(connectionId, zaloMessage.name, 1)
        const follower = await this.reads.newestWhere(connectionId, zaloUser.name, "followed", FOLLOWED)
        return zaloFactsOf(event?.occurredAt, message?.occurredAt, follower !== null)
    }

    /**
     * The people who wrote to the OA after a moment, newest first, one per Zalo user, at most `limit`: the newest stored inbound messages of
     * the account are read (the engine's own record of what customers wrote), each person is named from their stored user row.
     */
    async writersSince(connectionId: string, since: Date, limit: number): Promise<ReadonlyArray<ZaloWriter>> {
        const newest = await this.reads.newest(connectionId, zaloMessage.name, MESSAGES_LOOKED_AT)
        const lastOf = new Map<string, Date>()
        for (const row of newest) {
            const { userId, direction } = row.value
            if (typeof userId !== "string" || userId === "" || direction !== INBOUND) continue
            if (row.occurredAt.getTime() < since.getTime() || lastOf.has(userId)) continue
            lastOf.set(userId, row.occurredAt)
            if (lastOf.size >= limit) break
        }
        return Promise.all(
            [...lastOf].map(async ([userId, at]) => {
                const user = await this.reads.get(connectionId, zaloUser.name, userId)
                const name = user?.value.name
                return { userId, name: typeof name === "string" ? name : "", lastAt: at.toISOString() }
            }),
        )
    }
}
