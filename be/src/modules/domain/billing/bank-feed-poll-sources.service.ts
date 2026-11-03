import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap } from "@nestjs/common"
import { PollSourceRegistry } from "@modules/domain/connection-poll"
import type { ConnectionPoller, PollSourceDirectory, ScheduledPollSource } from "@modules/domain/connection-poll"
import { BankFeedPollerRegistry } from "@modules/domain/provider-registry"
import type { PolledCredit } from "@modules/domain/provider-registry"
import { BankFeedService } from "./bank-feed.service"

@Injectable()
/**
 * Offers the registered bank providers to the poll scheduler: each provider's reader with the one store every bank provider shares (the feed receipt
 * its webhook feeds, under the webhook's key), its limits and its error classes. It joins the scheduler once every provider module has registered.
 */
export class BankFeedPollSources implements PollSourceDirectory, OnApplicationBootstrap {
    constructor(
        private readonly registry: PollSourceRegistry,
        private readonly pollers: BankFeedPollerRegistry,
        private readonly feed: BankFeedService,
    ) {}

    /** Adds this directory to the scheduler. */
    onApplicationBootstrap(): void {
        this.registry.add(this)
    }

    /** The bank providers that registered a poller. */
    providers(): ReadonlyArray<string> {
        return this.pollers.all().map((poller) => poller.provider)
    }

    /** The scheduled source of a bank provider, or undefined when none registered. */
    sourceOf(provider: string): ScheduledPollSource | undefined {
        const poller = this.pollers.of(provider)
        if (poller === undefined) return undefined
        const bound: ConnectionPoller<PolledCredit> = {
            provider,
            fetch: (connection, window) => poller.fetch(connection, window),
            store: (connection, item) =>
                this.feed.acceptPolledCredit(connection.id, poller.inboxProvider, item.deliveryId, item.credit),
        }
        return { provider, limits: poller.limits, classify: (cause) => poller.classify(cause), poller: bound }
    }
}
