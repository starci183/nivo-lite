import { Injectable } from "@nestjs/common"
import type { PollFailure, PollLimits, PollPage, PollWindow } from "@modules/domain/connection-poll"
import type { ConnectionRecord } from "@modules/domain/connections"
import type { MessageInboxPoller } from "@modules/domain/provider-registry"
import { ProviderSandboxService } from "@modules/domain/provider-sandbox"
import type { PolledZaloItem } from "./zalo-inbox-poller.service"
import { ZALO_SANDBOX_CUSTOMERS, ZALO_SANDBOX_MESSAGES_STATE, zaloMessagesOf, type ZaloSandboxMessage } from "./zalo-sandbox.catalogue"

/** The name the OA's chat list shows for a customer, an empty text for one it does not know. */
const nameOf = (userId: string): string => ZALO_SANDBOX_CUSTOMERS.find((customer) => customer.userId === userId)?.name ?? ""

/** One message the account's cases made as the OA's chat list reports it. */
const chatMessageOf = (message: ZaloSandboxMessage): PolledZaloItem => ({
    messageId: message.messageId,
    userId: message.userId,
    userName: nameOf(message.userId),
    fromUser: true,
    kind: message.kind,
    text: message.text,
    sentAt: message.sentAt,
    stale: message.stale,
})

@Injectable()
/**
 * The sandbox twin of the Zalo inbox poller: it answers the window from the messages the account's inbound cases made (`ZALO-1..3`, kept in the
 * `messages` state), the customer texts that moved inside it, each marked stale or not when its case made it (a sandbox answer never reads the clock). Like the live poll it counts every
 * message of the window as fetched and keeps only the texts as items. It never calls Zalo and needs no access token.
 */
export class ZaloSandboxInboxPollerService implements MessageInboxPoller<PolledZaloItem> {
    readonly provider = "zalo_oa"
    /** The live poller's limits: the same scheduler contract. */
    readonly limits: PollLimits = { ratePerSecond: 2, burst: 4, concurrency: 2 }

    constructor(private readonly sandbox: ProviderSandboxService) {}

    /** The account's kept messages of the window as one page. */
    fetch(connection: ConnectionRecord, window: PollWindow): Promise<PollPage<PolledZaloItem>> {
        return this.sandbox.call(connection, "fetch", window, {
            key: window.from.toISOString(),
            answer: async (state): Promise<PollPage<PolledZaloItem>> => {
                const from = window.from.getTime()
                const to = window.to?.getTime() ?? Number.POSITIVE_INFINITY
                const kept = zaloMessagesOf(await state.read(ZALO_SANDBOX_MESSAGES_STATE, ""))
                const written = kept.filter((message) => message.sentAt >= from && message.sentAt <= to)
                    .map(chatMessageOf)
                    .toSorted((left, right) => right.sentAt - left.sentAt)
                    .slice(0, Math.max(0, window.limit))
                const times = written.map((message) => message.sentAt)
                return {
                    kind: "page",
                    items: written.filter((message) => message.kind === "text" && message.text.trim() !== ""),
                    fetched: written.length,
                    oldestAt: written.length === 0 ? undefined : new Date(Math.min(...times)),
                    newestAt: written.length === 0 ? undefined : new Date(Math.max(...times)),
                }
            },
        })
    }

    /** A sandbox read has no provider failure: anything thrown is given up on. */
    classify(): PollFailure {
        return { kind: "fatal" }
    }
}
