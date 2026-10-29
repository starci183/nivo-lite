import type { AiRouterService } from "@starci/ai-router"
import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AiGatewayOptions } from "./ai-gateway.options"

/** The router, or null when the pool has no key at all (no router is registered then). */
export type OptionalAiRouter = AiRouterService | null

/** Token of the options of the AI gateway, exported so a spec can provide it. */
export const AI_GATEWAY_OPTIONS: unique symbol = Symbol("integrations.ai-gateway.options")

/** Token of the router the pool reports on, exported so a spec can provide it. */
export const AI_GATEWAY_ROUTER: unique symbol = Symbol("integrations.ai-gateway.router")

/** Injects the options of the AI gateway. Parameter type: AiGatewayOptions. */
export const InjectAiGatewayOptions = (): TypedParameterDecorator<AiGatewayOptions> =>
    injector<AiGatewayOptions>(AI_GATEWAY_OPTIONS)

/** Injects the router of the pool (null is provided when the pool has no key). Parameter type: AiRouterService. */
export const InjectAiGatewayRouter = (): TypedParameterDecorator<AiRouterService> =>
    injector<AiRouterService>(AI_GATEWAY_ROUTER)
