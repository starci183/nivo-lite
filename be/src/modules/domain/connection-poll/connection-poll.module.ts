import { Module } from "@nestjs/common"
import type { DynamicModule, Provider } from "@nestjs/common"
import Redis from "ioredis"
import { POLL_LIMITER_STORE, POLL_RANDOM } from "./connection-poll.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./connection-poll.module-definition"
import { MemoryPollLimiterStore } from "./memory-poll-limiter.store"
import { PollLimiterService } from "./poll-limiter.service"
import { PollOwnerNoticeService } from "./poll-owner-notice.service"
import { PollScheduleService } from "./poll-schedule.service"
import { PollSchedulerService } from "./poll-scheduler.service"
import { PollSourceRegistry } from "./poll-source-registry.service"
import { RedisPollLimiterStore } from "./redis-poll-limiter.store"
import type { PollRedisOptions } from "./poll-schedule.contracts"

/** The limiter store of the options: Redis when the app declares it, else this process. */
const limiterStoreOf = (redis: PollRedisOptions | undefined): Provider =>
    redis === undefined
        ? { provide: POLL_LIMITER_STORE, useClass: MemoryPollLimiterStore }
        : {
              provide: POLL_LIMITER_STORE,
              useFactory: () =>
                  new RedisPollLimiterStore(
                      new Redis({ host: redis.host, port: redis.port, db: redis.db, password: redis.password, lazyConnect: true }),
                      redis.prefix,
                  ),
          }

const EXPORTED = [PollScheduleService, PollSchedulerService, PollSourceRegistry, PollLimiterService]

@Module({})
/**
 * The adaptive poll of connections for any provider that registers a source: the per-connection schedule, the limiter, the breaker and the tick that
 * polls what is due. Providers register through `PollSourceRegistry`; other modules call `PollScheduleService.markHot` and `recordWebhook`.
 */
export class ConnectionPollModule extends ConfigurableModuleClass {
    /** Registers the capability once in the API app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: POLL_RANDOM, useValue: () => Math.random() },
                limiterStoreOf(options.redis),
                ...EXPORTED,
                PollOwnerNoticeService,
            ],
            exports: EXPORTED,
        }
    }
}
