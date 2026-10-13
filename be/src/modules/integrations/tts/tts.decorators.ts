import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { Tts } from "./tts.port"
import type { TtsOptions } from "./tts.options"

/** Token of the text-to-speech options. */
export const TTS_OPTIONS: unique symbol = Symbol("integrations.tts.options")

/** Token of the Tts port. */
export const TTS: unique symbol = Symbol("integrations.tts.port")

/** Injects the text-to-speech options. Parameter type: TtsOptions. */
export const InjectTtsOptions = (): TypedParameterDecorator<TtsOptions> => injector<TtsOptions>(TTS_OPTIONS)

/** Injects the text-to-speech port. Parameter type: Tts. */
export const InjectTts = (): TypedParameterDecorator<Tts> => injector<Tts>(TTS)
