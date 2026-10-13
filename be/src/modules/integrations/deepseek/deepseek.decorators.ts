import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { DeepseekClient } from "./deepseek.client"
import type { DeepseekOptions } from "./deepseek.options"
import type { TextGenerator } from "./deepseek.port"

/** Token of the prompt library's options, exported so a spec can provide it. */
export const DEEPSEEK_OPTIONS: unique symbol = Symbol("integrations.deepseek.options")

/** Token of the text generator port. */
export const DEEPSEEK_TEXT_GENERATOR: unique symbol = Symbol("integrations.deepseek.text-generator")

/** Injects the options of the prompt library. Parameter type: DeepseekOptions. */
export const InjectDeepseekOptions = (): TypedParameterDecorator<DeepseekOptions> =>
    injector<DeepseekOptions>(DEEPSEEK_OPTIONS)

/** Injects the text generator port. Parameter type: TextGenerator. */
export const InjectDeepseekTextGenerator = (): TypedParameterDecorator<TextGenerator> =>
    injector<TextGenerator>(DEEPSEEK_TEXT_GENERATOR)

/** Token of the concrete prompt library, for callers outside the integration. */
export const DEEPSEEK_CLIENT: unique symbol = Symbol("integrations.deepseek.client")

/** Injects the prompt library through its integration-owned token. Parameter type: DeepseekClient. */
export const InjectDeepseekClient = (): TypedParameterDecorator<DeepseekClient> =>
    injector<DeepseekClient>(DEEPSEEK_CLIENT)
