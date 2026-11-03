import { Injectable } from "@nestjs/common"
import type { OnApplicationBootstrap } from "@nestjs/common"
import { PollSourceRegistry } from "@modules/domain/connection-poll"
import type { PollSourceDirectory, ScheduledPollSource } from "@modules/domain/connection-poll"
import { MessageInboxPollerRegistry } from "@modules/domain/provider-registry"

@Injectable()
/**
 * Offers the registered messaging providers to the poll scheduler: each provider's reader, its limits and its error classes. The provider already
 * stores into the inbox its webhook feeds, so nothing is bound here. It joins the scheduler once every provider module has registered.
 */
export class MessageInboxPollSources implements PollSourceDirectory, OnApplicationBootstrap {
    constructor(
        private readonly registry: PollSourceRegistry,
        private readonly pollers: MessageInboxPollerRegistry,
    ) {}

    /** Adds this directory to the scheduler. */
    onApplicationBootstrap(): void {
        this.registry.add(this)
    }

    /** The messaging providers that registered a poller. */
    providers(): ReadonlyArray<string> {
        return this.pollers.all().map((poller) => poller.provider)
    }

    /** The scheduled source of a messaging provider, or undefined when none registered. */
    sourceOf(provider: string): ScheduledPollSource | undefined {
        const poller = this.pollers.of(provider)
        if (poller === undefined) return undefined
        return { provider, limits: poller.limits, classify: (cause) => poller.classify(cause), poller }
    }
}
