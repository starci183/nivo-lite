import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { ElevenLabsClient } from "./elevenlabs.client"
import type { ElevenLabsOptions } from "./elevenlabs.options"

/** Token of the ElevenLabs client. */
export const ELEVENLABS: unique symbol = Symbol("integrations.elevenlabs")

/** Token of the options of the ElevenLabs integration, exported so a spec can provide it. */
export const ELEVENLABS_OPTIONS: unique symbol = Symbol("integrations.elevenlabs.options")

/** Injects the options of the ElevenLabs integration. Parameter type: ElevenLabsOptions. */
export const InjectElevenLabsOptions = (): TypedParameterDecorator<ElevenLabsOptions> =>
    injector<ElevenLabsOptions>(ELEVENLABS_OPTIONS)

/** Injects the ElevenLabs client. Parameter type: ElevenLabsClient. */
export const InjectElevenLabs = (): TypedParameterDecorator<ElevenLabsClient> => injector<ElevenLabsClient>(ELEVENLABS)
