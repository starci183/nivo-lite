import { randomInt } from "node:crypto"
import type { Provider, Type } from "@nestjs/common"
import { REDIS_CLIENT } from "@modules/integrations/redis"
import type { RedisClient } from "@modules/integrations/redis"
import { POLL_LIMITER_STORE, POLL_RANDOM, POLL_REDIS, POLL_REDIS_PREFIX } from "./connection-poll.decorators"
import type { PollRandom } from "./connection-poll.decorators"
import type { ConnectionPollOptions, PollRedisOptions } from "./connection-poll.options"
import { FirstPollEnqueueService } from "./first-poll-enqueue.service"
import { MemoryPollLimiterStore } from "./memory-poll-limiter.adapter"
import { PollLimiterService } from "./poll-limiter.service"
import { PollOwnerNoticeService } from "./poll-owner-notice.service"
import { PollScheduleService } from "./poll-schedule.service"
import { PollSchedulerService } from "./poll-scheduler.service"
import { PollSourceRegistryService } from "./poll-source-registry.service"
import { RedisPollLimiterStore } from "./redis-poll-limiter.client"

/** How many equal steps the random source divides [0, 1) into. */
const RANDOM_STEPS = 1_000_000

/** What other modules call: the schedule, the scheduler, the source registry and the limiter. */
export const POLL_EXPORTED: ReadonlyArray<Type> = [
    FirstPollEnqueueService,
    PollScheduleService,
    PollSchedulerService,
    PollSourceRegistryService,
    PollLimiterService,
]

/** The random source of the system, for the jitter of a planned time. */
export const systemRandom: PollRandom = { next: () => randomInt(0, RANDOM_STEPS) / RANDOM_STEPS }

/** The providers of the limiter store of the options: Redis when the app declares it, else this process. */
export const limiterStoreProvidersOf = (redis: PollRedisOptions | undefined): Array<Provider> =>
    redis === undefined
        ? [{ provide: POLL_LIMITER_STORE, useClass: MemoryPollLimiterStore }]
        : [
              {
                  provide: POLL_REDIS,
                  useFactory: (client: RedisClient) =>
                      client.open({ host: redis.host, port: redis.port, db: redis.db, password: redis.password }),
                  inject: [REDIS_CLIENT],
              },
              { provide: POLL_REDIS_PREFIX, useValue: redis.prefix },
              { provide: POLL_LIMITER_STORE, useClass: RedisPollLimiterStore },
          ]

/** Every provider of the capability for the options of the app. */
export const pollProvidersOf = (options: ConnectionPollOptions): Array<Provider> => [
    { provide: POLL_RANDOM, useValue: systemRandom },
    ...limiterStoreProvidersOf(options.redis),
    ...POLL_EXPORTED,
    PollOwnerNoticeService,
]
