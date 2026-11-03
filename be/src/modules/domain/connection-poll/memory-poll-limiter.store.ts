import { Injectable } from "@nestjs/common"
import type { PollLimits } from "./connection-poll.contracts"
import { takeToken } from "./poll-bucket.policy"
import type { BucketState } from "./poll-bucket.policy"
import type { PollLimiterStore, TokenAnswer } from "./poll-limiter.contracts"

@Injectable()
/** The limiter state of one process: for tests and for an app that runs one replica and declares no Redis. */
export class MemoryPollLimiterStore implements PollLimiterStore {
    private readonly buckets = new Map<string, BucketState>()
    private readonly slots = new Map<string, Map<string, number>>()

    /** Takes one call from the bucket of `key`. */
    take(key: string, limits: PollLimits, now: number): Promise<TokenAnswer> {
        const taken = takeToken(this.buckets.get(key), now, limits)
        this.buckets.set(key, taken.state)
        return Promise.resolve({ allowed: taken.allowed, waitMs: taken.waitMs })
    }

    /** Takes a slot of `key` for `member`; a lease that ran out frees its slot. */
    enter(key: string, member: string, cap: number, leaseMs: number, now: number): Promise<boolean> {
        const held = new Map([...(this.slots.get(key) ?? new Map<string, number>())].filter(([, until]) => until > now))
        const granted = held.size < cap
        if (granted) held.set(member, now + leaseMs)
        this.slots.set(key, held)
        return Promise.resolve(granted)
    }

    /** Gives the slot of `member` back. */
    leave(key: string, member: string): Promise<void> {
        this.slots.get(key)?.delete(member)
        return Promise.resolve()
    }
}
