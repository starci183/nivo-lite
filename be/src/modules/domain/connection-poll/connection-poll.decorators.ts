import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { PollLimiterStore } from "./poll-limiter.contracts"
import type { ConnectionPollOptions } from "./poll-schedule.contracts"

/** Token of the connection-poll options, exported so a spec can provide it. */
export const CONNECTION_POLL_OPTIONS: unique symbol = Symbol("domain.connection-poll.options")

/** Token of the store the rate limiter keeps its buckets and slots in. */
export const POLL_LIMITER_STORE: unique symbol = Symbol("domain.connection-poll.limiter-store")

/** Token of the source of random numbers the planner jitters with. */
export const POLL_RANDOM: unique symbol = Symbol("domain.connection-poll.random")

/** Answers a random number in [0, 1). */
export type PollRandom = () => number

/** Injects the options of the connection-poll capability. Parameter type: ConnectionPollOptions. */
export const InjectConnectionPollOptions = (): TypedParameterDecorator<ConnectionPollOptions> =>
    injector<ConnectionPollOptions>(CONNECTION_POLL_OPTIONS)

/** Injects the rate limiter store. Parameter type: PollLimiterStore. */
export const InjectPollLimiterStore = (): TypedParameterDecorator<PollLimiterStore> =>
    injector<PollLimiterStore>(POLL_LIMITER_STORE)

/** Injects the random source. Parameter type: PollRandom. */
export const InjectPollRandom = (): TypedParameterDecorator<PollRandom> => injector<PollRandom>(POLL_RANDOM)
