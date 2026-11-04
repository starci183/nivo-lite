import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { PollLimiterStore, PollRedis } from "./poll-limiter.contracts"
import type { ConnectionPollOptions } from "./connection-poll.options"

/** Token of the connection-poll options, exported so a spec can provide it. */
export const CONNECTION_POLL_OPTIONS: unique symbol = Symbol("domain.connection-poll.options")

/** Token of the store the rate limiter keeps its buckets and slots in. */
export const POLL_LIMITER_STORE: unique symbol = Symbol("domain.connection-poll.limiter-store")

/** Token of the Redis connection the Redis limiter store runs its scripts on. */
export const POLL_REDIS: unique symbol = Symbol("domain.connection-poll.redis")

/** Token of the prefix the Redis limiter store puts before every key. */
export const POLL_REDIS_PREFIX: unique symbol = Symbol("domain.connection-poll.redis-prefix")

/** Token of the source of random numbers the planner jitters with. */
export const POLL_RANDOM: unique symbol = Symbol("domain.connection-poll.random")

/** The source of the random numbers the planner jitters with. */
export interface PollRandom {
    /** A random number in [0, 1). */
    next(): number
}

/** Injects the options of the connection-poll capability. Parameter type: ConnectionPollOptions. */
export const InjectConnectionPollOptions = (): TypedParameterDecorator<ConnectionPollOptions> =>
    injector<ConnectionPollOptions>(CONNECTION_POLL_OPTIONS)

/** Injects the rate limiter store. Parameter type: PollLimiterStore. */
export const InjectPollLimiterStore = (): TypedParameterDecorator<PollLimiterStore> =>
    injector<PollLimiterStore>(POLL_LIMITER_STORE)

/** Injects the Redis connection of the limiter store. Parameter type: PollRedis. */
export const InjectPollRedis = (): TypedParameterDecorator<PollRedis> => injector<PollRedis>(POLL_REDIS)

/** Injects the key prefix of the Redis limiter store. Parameter type: string. */
export const InjectPollRedisPrefix = (): TypedParameterDecorator<string> => injector<string>(POLL_REDIS_PREFIX)

/** Injects the random source. Parameter type: PollRandom. */
export const InjectPollRandom = (): TypedParameterDecorator<PollRandom> => injector<PollRandom>(POLL_RANDOM)
