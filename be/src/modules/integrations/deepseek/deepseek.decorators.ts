import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { DeepseekClient } from "./deepseek.client"
import type { DeepseekOptions } from "./deepseek.options"
import type { DeepseekMeter, DeepseekPool, DeepseekTextGenerator } from "./deepseek.port"

/** Token of the prompt library's options, exported so a spec can provide it. */
export const DEEPSEEK_OPTIONS: unique symbol = Symbol("integrations.deepseek.options")

/** Token of the text generator port. */
export const DEEPSEEK_TEXT_GENERATOR: unique symbol = Symbol("integrations.deepseek.text-generator")

/** Token of the AI pool port. */
export const DEEPSEEK_POOL: unique symbol = Symbol("integrations.deepseek.pool")

/** Token of the usage meter port. */
export const DEEPSEEK_METER: unique symbol = Symbol("integrations.deepseek.meter")

/** Injects the options of the prompt library. Parameter type: DeepseekOptions. */
export const InjectDeepseekOptions = (): TypedParameterDecorator<DeepseekOptions> =>
    injector<DeepseekOptions>(DEEPSEEK_OPTIONS)

/** Injects the text generator port. Parameter type: DeepseekTextGenerator. */
export const InjectDeepseekTextGenerator = (): TypedParameterDecorator<DeepseekTextGenerator> =>
    injector<DeepseekTextGenerator>(DEEPSEEK_TEXT_GENERATOR)

/** Injects the AI pool port. Parameter type: DeepseekPool. */
export const InjectDeepseekPool = (): TypedParameterDecorator<DeepseekPool> => injector<DeepseekPool>(DEEPSEEK_POOL)

/** Injects the usage meter port. Parameter type: DeepseekMeter. */
export const InjectDeepseekMeter = (): TypedParameterDecorator<DeepseekMeter> => injector<DeepseekMeter>(DEEPSEEK_METER)

/** Token of the concrete prompt library, for callers outside the integration. */
export const DEEPSEEK_CLIENT: unique symbol = Symbol("integrations.deepseek.client")

/** Injects the prompt library through its integration-owned token. Parameter type: DeepseekClient. */
export const InjectDeepseekClient = (): TypedParameterDecorator<DeepseekClient> =>
    injector<DeepseekClient>(DEEPSEEK_CLIENT)
