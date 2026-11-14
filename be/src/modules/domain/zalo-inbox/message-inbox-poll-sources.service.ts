import { Injectable, type OnApplicationBootstrap } from "@nestjs/common"
import {
    PollSourceRegistryService,
    type PollSourceDirectory,
    type ScheduledPollSource,
} from "@modules/domain/connection-poll"
import { ZaloPolledInboxService } from "./zalo-polled-inbox.service"

@Injectable()
/**
 * Offers the Zalo inbox poll to the poll scheduler: the provider's reader with its limits and error classes, and the intake that keeps
 * what it read under the webhook's key. It joins the scheduler once every module has registered.
 */
export class MessageInboxPollSourcesService implements PollSourceDirectory, OnApplicationBootstrap {
    constructor(
        private readonly registry: PollSourceRegistryService,
        private readonly zalo: ZaloPolledInboxService,
    ) {}

    /** Adds this directory to the scheduler. */
    onApplicationBootstrap(): void {
        this.registry.add(this)
    }

    /** The messaging providers whose inbox is polled. */
    providers(): ReadonlyArray<string> {
        return [this.zalo.provider]
    }

    /** The scheduled source of a messaging provider, or undefined for any other. */
    sourceOf(provider: string): ScheduledPollSource | undefined {
        if (provider !== this.zalo.provider) return undefined
        return { provider, limits: this.zalo.limits, classify: (cause) => this.zalo.classify(cause), poller: this.zalo }
    }
}
