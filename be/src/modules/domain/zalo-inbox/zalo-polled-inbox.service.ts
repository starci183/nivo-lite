import { Injectable } from "@nestjs/common"
import type { ConnectionPoller, PollFailure, PollLimits, PollPage, PollWindow } from "@modules/domain/connection-poll"
import type { ConnectionRecord } from "@modules/domain/connections"
import { ZaloInboxPollerService, type PolledZaloItem } from "@modules/domain/zalo-provider"
import { ZaloInboxService } from "./zalo-inbox.service"

@Injectable()
/**
 * The Zalo poll as the connection poll walks it: the provider reads the OA's chats back (its poll face), and the intake keeps each text the
 * way the webhook would have (the same `zalo_oa.event` key, so a message the webhook already delivered is a no-op). A stale message is kept
 * for the owner and no agent answers it.
 */
export class ZaloPolledInboxService implements ConnectionPoller<PolledZaloItem> {
    readonly provider: string
    readonly limits: PollLimits

    constructor(
        private readonly poller: ZaloInboxPollerService,
        private readonly inbox: ZaloInboxService,
    ) {
        this.provider = poller.provider
        this.limits = poller.limits
    }

    /** Reads one page of one connection through the provider. */
    fetch(connection: ConnectionRecord, window: PollWindow): Promise<PollPage<PolledZaloItem>> {
        return this.poller.fetch(connection, window)
    }

    /** Keeps one polled text through the inbox the webhook feeds; false when the webhook (or an earlier poll) already did. */
    store(connection: ConnectionRecord, item: PolledZaloItem): Promise<boolean> {
        return this.inbox.acceptPolledMessage(
            connection.id,
            { messageId: item.messageId, userId: item.userId, userName: item.userName, text: item.text, sentAt: item.sentAt },
            { workspaceId: connection.workspaceId, sender: item.userName || item.userId, stale: item.stale },
        )
    }

    /** Classifies a failure of `fetch`, as the provider reads it. */
    classify(error: unknown): PollFailure {
        return this.poller.classify(error)
    }
}
