import { Module } from "@nestjs/common"
import type { DynamicModule, Provider } from "@nestjs/common"
import type { EntityManager } from "typeorm"
import Redis from "ioredis"
import { Client } from "pg"
import { MemoryRealtimeHubService } from "./memory-realtime-hub.service"
import { NoRealtimeRetentionService } from "./no-realtime-retention.service"
import { PostgresListenerClient } from "./postgres-listener.client"
import type { ListenConnection } from "./postgres-listener.port"
import { PostgresRealtimeHubService } from "./postgres-realtime-hub.service"
import { RealtimeRetentionService } from "./realtime-retention.service"
import {
    REALTIME_MANAGERS,
    REALTIME_HUB,
    REALTIME_LISTENER,
    REALTIME_LISTEN_FACTORY,
    REALTIME_RETENTION,
    REALTIME_POSTGRES_OPTIONS,
    REALTIME_REDIS_OPTIONS,
    REALTIME_REDIS_PUBLISHER,
    REALTIME_REDIS_SUBSCRIBER,
    REALTIME_TIMER,
} from "./realtime.decorators"
import { ConfigurableModuleClass, OPTIONS_TYPE } from "./realtime.module-definition"
import type { PostgresRealtimeOptions, RedisRealtimeOptions } from "./realtime.options"
import { TIMER } from "@modules/platform/retry"
import type { Timer } from "@modules/platform/retry"
import { RedisRealtimeHubService } from "./redis-realtime-hub.service"

/** The retention of a hub that keeps no replay table (memory, Redis): a scheduled tick is acknowledged and finds nothing to sweep. */
const noRetention: Provider = { provide: REALTIME_RETENTION, useClass: NoRealtimeRetentionService }

/** The non-scale providers: the in-process hub. */
const memoryProviders = (): Array<Provider> => [
    { provide: REALTIME_HUB, useClass: MemoryRealtimeHubService },
    noRetention,
]

/** The Postgres providers: the hub with its LISTEN connection, and the retention sweep. */
const postgresProviders = (options: PostgresRealtimeOptions): Array<Provider> => [
    { provide: REALTIME_POSTGRES_OPTIONS, useValue: options },
    {
        provide: REALTIME_MANAGERS,
        useFactory: (manager: EntityManager) => [manager],
        inject: [options.connection],
    },
    {
        provide: REALTIME_LISTEN_FACTORY,
        useValue: { create: (url: string): ListenConnection => new Client({ connectionString: url }) },
    },
    PostgresListenerClient,
    { provide: REALTIME_LISTENER, useExisting: PostgresListenerClient },
    PostgresRealtimeHubService,
    { provide: REALTIME_HUB, useExisting: PostgresRealtimeHubService },
    RealtimeRetentionService,
    { provide: REALTIME_RETENTION, useExisting: RealtimeRetentionService },
]

/** One Redis connection to the address the hub is configured with. */
const connectionTo = (options: RedisRealtimeOptions): Redis => new Redis(options.url.reveal(), { db: options.db })

/** The Redis providers: the hub over two connections. */
const redisProviders = (options: RedisRealtimeOptions): Array<Provider> => {
    return [
        { provide: REALTIME_REDIS_OPTIONS, useValue: options },
        noRetention,
        { provide: REALTIME_REDIS_PUBLISHER, useFactory: () => connectionTo(options) },
        { provide: REALTIME_REDIS_SUBSCRIBER, useFactory: () => connectionTo(options) },
        RedisRealtimeHubService,
        { provide: REALTIME_HUB, useExisting: RedisRealtimeHubService },
    ]
}

/** The providers of the Postgres hub when the options select it, else of the memory hub. */
const postgresOrMemoryProviders = (options: typeof OPTIONS_TYPE): Array<Provider> =>
    options.hub === "postgres" ? postgresProviders(options) : memoryProviders()

/** The providers of the hub the options select. */
const providersOf = (options: typeof OPTIONS_TYPE): Array<Provider> =>
    options.hub === "redis" ? redisProviders(options) : postgresOrMemoryProviders(options)

@Module({})
/**
 * Provides the RealtimeHub port of the app, selected by `options.hub`: `memory` is the non-scale hub of tests
 * and a single replica, `postgres` and `redis` the shared hubs of N replicas.
 */
export class RealtimeModule extends ConfigurableModuleClass {
    /** Registers the capability once per app. */
    static register(options: typeof OPTIONS_TYPE): DynamicModule {
        const base = super.register(options)
        return {
            ...base,
            providers: [
                ...(base.providers ?? []),
                { provide: REALTIME_TIMER, useFactory: (timer: Timer) => timer, inject: [TIMER] },
                ...providersOf(options),
            ],
            exports: [REALTIME_HUB, REALTIME_RETENTION],
        }
    }
}
