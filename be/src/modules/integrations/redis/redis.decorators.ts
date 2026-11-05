import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { RedisClient } from "./redis.client"
import type { RedisOptions } from "./redis.options"

/** Token of the Redis options. */
export const REDIS_OPTIONS: unique symbol = Symbol("integrations.redis.options")

/** Token of the client that opens Redis connections. */
export const REDIS_CLIENT: unique symbol = Symbol("integrations.redis.client")

/** Injects the Redis options. Parameter type: RedisOptions. */
export const InjectRedisOptions = (): TypedParameterDecorator<RedisOptions> => injector<RedisOptions>(REDIS_OPTIONS)

/** Injects the client that opens Redis connections. Parameter type: RedisClient. */
export const InjectRedisClient = (): TypedParameterDecorator<RedisClient> => injector<RedisClient>(REDIS_CLIENT)
