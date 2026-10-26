import type { EntityManager } from "typeorm"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ListenFactory, NotificationListener } from "./postgres-listener.port"
import type { PostgresRealtimeOptions, RedisRealtimeOptions } from "./realtime.options"
import type { RealtimeHub } from "./realtime.port"
import type { RealtimeRetention } from "./realtime-retention.port"
import type { Timer } from "@modules/platform/retry"
import type { RedisConnection } from "./redis-realtime.port"

/** Token of the options of the realtime capability, exported so a spec can provide it. */
export const REALTIME_OPTIONS: unique symbol = Symbol("platform.realtime.options")

/** Token of the RealtimeHub port. */
export const REALTIME_HUB: unique symbol = Symbol("platform.realtime.hub")

/** Token of the options of a Postgres hub (provided only when the app runs one). */
export const REALTIME_POSTGRES_OPTIONS: unique symbol = Symbol("platform.realtime.postgres-options")

/** Token of the entity managers of the connections that hold the realtime tables, in the order the options name them. */
export const REALTIME_MANAGERS: unique symbol = Symbol("platform.realtime.managers")

/** Token of the LISTEN connection port. */
export const REALTIME_LISTENER: unique symbol = Symbol("platform.realtime.listener")

/** Token of the factory that opens a LISTEN connection (the one place the pg driver is constructed). */
export const REALTIME_LISTEN_FACTORY: unique symbol = Symbol("platform.realtime.listen-factory")

/** Token of the retention of the replay table. */
export const REALTIME_RETENTION: unique symbol = Symbol("platform.realtime.retention")

/** Token of the options of a Redis hub (provided only when the app runs one). */
export const REALTIME_REDIS_OPTIONS: unique symbol = Symbol("platform.realtime.redis-options")

/** Token of the Redis connection the Redis hub publishes and reads streams through. */
export const REALTIME_REDIS_PUBLISHER: unique symbol = Symbol("platform.realtime.redis-publisher")

/** Token of the Redis connection the Redis hub subscribes through. */
export const REALTIME_REDIS_SUBSCRIBER: unique symbol = Symbol("platform.realtime.redis-subscriber")

/** Injects the RealtimeHub port. Parameter type: RealtimeHub. */
export const InjectRealtimeHub = (): TypedParameterDecorator<RealtimeHub> => injector<RealtimeHub>(REALTIME_HUB)

/** Injects the options of a Postgres hub. Parameter type: PostgresRealtimeOptions. */
export const InjectPostgresRealtimeOptions = (): TypedParameterDecorator<PostgresRealtimeOptions> =>
    injector<PostgresRealtimeOptions>(REALTIME_POSTGRES_OPTIONS)

/** Injects the entity managers of the connections that hold the realtime tables. Parameter type: ReadonlyArray<EntityManager>. */
export const InjectRealtimeManagers = (): TypedParameterDecorator<ReadonlyArray<EntityManager>> =>
    injector<ReadonlyArray<EntityManager>>(REALTIME_MANAGERS)

/** Injects the factory that opens a LISTEN connection. Parameter type: ListenFactory. */
export const InjectListenFactory = (): TypedParameterDecorator<ListenFactory> =>
    injector<ListenFactory>(REALTIME_LISTEN_FACTORY)

/** Injects the LISTEN connection port. Parameter type: NotificationListener. */
export const InjectNotificationListener = (): TypedParameterDecorator<NotificationListener> =>
    injector<NotificationListener>(REALTIME_LISTENER)

/** Injects the retention of the replay table. Parameter type: RealtimeRetention. */
export const InjectRealtimeRetention = (): TypedParameterDecorator<RealtimeRetention> =>
    injector<RealtimeRetention>(REALTIME_RETENTION)

/** Injects the options of a Redis hub. Parameter type: RedisRealtimeOptions. */
export const InjectRedisRealtimeOptions = (): TypedParameterDecorator<RedisRealtimeOptions> =>
    injector<RedisRealtimeOptions>(REALTIME_REDIS_OPTIONS)

/** Injects the Redis connection of the publishing side. Parameter type: RedisConnection. */
export const InjectRedisPublisher = (): TypedParameterDecorator<RedisConnection> =>
    injector<RedisConnection>(REALTIME_REDIS_PUBLISHER)

/** Injects the Redis connection of the subscribing side. Parameter type: RedisConnection. */
export const InjectRedisSubscriber = (): TypedParameterDecorator<RedisConnection> =>
    injector<RedisConnection>(REALTIME_REDIS_SUBSCRIBER)

/** Token of the cancellable timer the hubs schedule their reload retries with. */
export const REALTIME_TIMER: unique symbol = Symbol("platform.realtime.timer")

/** Injects the cancellable timer. Parameter type: Timer. */
export const InjectRealtimeTimer = (): TypedParameterDecorator<Timer> => injector<Timer>(REALTIME_TIMER)
