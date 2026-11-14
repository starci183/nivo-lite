import { Injectable, type OnApplicationBootstrap } from "@nestjs/common"
import {
    PollSourceRegistryService,
    type ConnectionPoller,
    type PollSourceDirectory,
    type ScheduledPollSource,
} from "@modules/domain/connection-poll"
import type { ConnectionRecord } from "@modules/domain/connections"
import {
    BankFeedPollerRegistryService,
    ProviderRegistryError,
    ProviderRegistryErrorCode,
    type BankFeedPoller,
    type PolledCredit,
} from "@modules/domain/provider-registry"
import { BankFeedReceiptsService } from "./bank-feed-receipts.service"

@Injectable()
/**
 * Offers the registered bank providers to the poll scheduler: each provider's reader with the one store every bank provider shares (the feed receipt
 * its webhook feeds, under the webhook's key), its limits and its error classes. It joins the scheduler once every provider module has registered.
 */
export class BankFeedPollSourcesService implements PollSourceDirectory, OnApplicationBootstrap {
    constructor(
        private readonly registry: PollSourceRegistryService,
        private readonly pollers: BankFeedPollerRegistryService,
        private readonly feed: BankFeedReceiptsService,
    ) {}

    /** Adds this directory to the scheduler. */
    onApplicationBootstrap(): void {
        this.registry.add(this)
    }

    /** The bank providers that registered a poller. */
    providers(): ReadonlyArray<string> {
        return this.pollers.providers()
    }

    /** The scheduled source of a bank provider, or undefined when none registered. */
    sourceOf(provider: string): ScheduledPollSource | undefined {
        const poller = this.pollers.liveOf(provider)
        if (poller === undefined) return undefined
        // The schedule's facts (limits, classify, inbox) are the provider's; each ACCOUNT is read through the one switch, so a sandbox
        // account's poll answers from its fixtures (lane concept provider-sandbox) or is refused, never polled live.
        const bound: ConnectionPoller<PolledCredit> = {
            provider,
            fetch: (connection, window) => this.pollerOf(connection).fetch(connection, window),
            store: (connection, item) =>
                this.feed.acceptPolledCredit(connection.id, poller.inboxProvider, item.deliveryId, item.credit),
        }
        return { provider, limits: poller.limits, classify: (cause) => poller.classify(cause), poller: bound }
    }

    /** The poller that reads one account; a provider whose poller left the registry is a typed refusal. */
    private pollerOf(connection: ConnectionRecord): BankFeedPoller {
        const poller = this.pollers.portFor(connection)
        if (poller === undefined) {
            throw new ProviderRegistryError({ code: ProviderRegistryErrorCode.SandboxMissing, params: { provider: connection.provider } })
        }
        return poller
    }
}
