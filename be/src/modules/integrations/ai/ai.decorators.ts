import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { AiService } from "./ai.service"
import type { AiRunner } from "./ai.contracts"
import type { AiEndpoint, AiOptions } from "./ai.options"

/** The runner, or null when no key or base URL is set (nothing is built then). */
export type OptionalAiRunner = AiRunner | null

/** Token of the endpoint options, exported so a spec can provide it. */
export const AI_OPTIONS: unique symbol = Symbol("integrations.ai.options")

/** Token of the runner the client calls through, exported so a spec can provide a double. */
export const AI_RUNNER: unique symbol = Symbol("integrations.ai.runner")

/** Token of the LangChain client. */
export const AI: unique symbol = Symbol("integrations.ai")

/** Injects the endpoint options. Parameter type: AiOptions. */
export const InjectAiOptions = (): TypedParameterDecorator<AiOptions> => injector<AiOptions>(AI_OPTIONS)

/** Injects the runner (null is provided when no key is set). Parameter type: AiRunner. */
export const InjectAiRunner = (): TypedParameterDecorator<AiRunner> => injector<AiRunner>(AI_RUNNER)

/** Injects the LangChain client. Parameter type: AiService. */
export const InjectAi = (): TypedParameterDecorator<AiService> => injector<AiService>(AI)

/** Token of the endpoint the clients call, exported so a spec can provide it. */
export const AI_ENDPOINT_OPTIONS: unique symbol = Symbol("integrations.ai.endpoint-options")

/** Injects the endpoint the clients call. Parameter type: AiEndpoint. */
export const InjectAiEndpointOptions = (): TypedParameterDecorator<AiEndpoint> =>
    injector<AiEndpoint>(AI_ENDPOINT_OPTIONS)
