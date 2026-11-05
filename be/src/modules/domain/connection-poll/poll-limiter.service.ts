import { Injectable } from "@nestjs/common"
import { InjectClock } from "@modules/platform/clock"
import type { Clock } from "@modules/platform/clock"
import { InjectTimer } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { InjectConnectionPollOptions, InjectPollLimiterStore } from "./connection-poll.decorators"
import type { PollLimits } from "./connection-poll.contracts"
import { ConnectionPollError, ConnectionPollErrorCode } from "./errors/connection-poll.error"
import type { OptionalPollSlot, PollLimiterStore } from "./poll-limiter.contracts"
import type { ConnectionPollOptions } from "./connection-poll.options"

/** How many times a call waits for its token before the poll gives up for now. */
const MAX_WAITS = 3

@Injectable()
/**
 * The two limits a provider declares, spent per credential: a token bucket per connection (every tenant has its own provider token, so the provider
 * limits each separately) and a cap on the calls in flight to the provider across all of them. The state lives in the store, shared by every replica
 * when the app declares Redis.
 */
export class PollLimiterService {
    constructor(
        @InjectClock() private readonly clock: Clock,
        @InjectTimer() private readonly timer: Timer,
        @InjectPollLimiterStore() private readonly store: PollLimiterStore,
        @InjectConnectionPollOptions() private readonly options: ConnectionPollOptions,
    ) {}

    /** Takes one of the provider's concurrency slots for the connection; undefined when all are taken. */
    async enter(provider: string, connectionId: string, limits: PollLimits): Promise<OptionalPollSlot> {
        const { leaseMs } = this.options.schedule
        const granted = await this.store.enter(
            provider,
            connectionId,
            limits.concurrency,
            leaseMs,
            this.clock.now().getTime(),
        )
        return granted ? { release: () => this.store.leave(provider, connectionId) } : undefined
    }

    /**
     * Passes when the connection's bucket holds a token, waiting for one when it comes within the inline wait. A wait that is longer, or a bucket that
     * stays empty, ends the poll with a `Deferred` error that names the wait, so the scheduler plans the connection again after it.
     */
    pass(provider: string, connectionId: string, limits: PollLimits): Promise<void> {
        return this.passAfter(provider, connectionId, limits, 0)
    }

    private async passAfter(provider: string, connectionId: string, limits: PollLimits, waits: number): Promise<void> {
        const answer = await this.store.take(`${provider}:${connectionId}`, limits, this.clock.now().getTime())
        if (answer.allowed) return
        if (answer.waitMs > this.options.schedule.maxInlineWaitMs || waits >= MAX_WAITS) {
            throw new ConnectionPollError({ code: ConnectionPollErrorCode.Deferred, params: { waitMs: answer.waitMs } })
        }
        await new Promise<void>((resolve) => {
            this.timer.schedule(resolve, answer.waitMs)
        })
        await this.passAfter(provider, connectionId, limits, waits + 1)
    }
}
