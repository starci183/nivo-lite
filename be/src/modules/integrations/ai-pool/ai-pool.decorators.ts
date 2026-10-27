import type { AiRouterService } from "@starci/ai-router"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AiPoolOptions } from "./ai-pool.options"

/** The router, or null when the pool has no key at all (no router is registered then). */
export type OptionalAiRouter = AiRouterService | null

/** Token of the options of the AI pool, exported so a spec can provide it. */
export const AI_POOL_OPTIONS: unique symbol = Symbol("integrations.ai-pool.options")

/** Token of the router the pool calls through, exported so a spec can provide it. */
export const AI_POOL_ROUTER: unique symbol = Symbol("integrations.ai-pool.router")

/** Injects the options of the AI pool. Parameter type: AiPoolOptions. */
export const InjectAiPoolOptions = (): TypedParameterDecorator<AiPoolOptions> =>
    injector<AiPoolOptions>(AI_POOL_OPTIONS)

/** Injects the router of the pool (null is provided when the pool has no key). Parameter type: AiRouterService. */
export const InjectAiPoolRouter = (): TypedParameterDecorator<AiRouterService> =>
    injector<AiRouterService>(AI_POOL_ROUTER)
