import { Injectable } from "@nestjs/common"
import { ApiKeysService } from "@modules/domain/api-keys"
import { EventsReadService } from "@modules/domain/events"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { PublicApiError } from "./errors/public-api.error"
import type { EventsPage, ListEventsParams } from "./public-api.contracts"
import { clampLimit, eventsSince } from "./public-api.policy"

/** Events listed by default and at most. */
const EVENTS_LIMIT_DEFAULT = 100
const EVENTS_LIMIT_MAX = 500

@Injectable()
/** The evidence log the public API pulls for the workspace of a key, read through the events capability. */
export class PublicEventsService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        private readonly keys: ApiKeysService,
        private readonly eventReads: EventsReadService,
    ) {}

    /** The evidence lines of the key's workspace after `since` (one day back when absent), oldest first, with the cursor for the next call. */
    async listEvents(params: ListEventsParams): Promise<EventsPage> {
        const who = await this.keys.authenticate("events:read", params.authorization)
        const from = eventsSince(params.since, this.clock.now())
        if (from.kind === "refused") throw new PublicApiError({ code: from.code })
        const limit = clampLimit(params.limit, EVENTS_LIMIT_DEFAULT, EVENTS_LIMIT_MAX)
        const events = await this.eventReads.listAfter(who.workspaceId, from.value, limit)
        return { events, nextSince: events.at(-1)?.createdAt ?? from.value }
    }
}
