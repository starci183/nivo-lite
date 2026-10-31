import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { BackgroundVoice } from "./agent-schedules.contracts"

/** Token of the background voice port: bound by the capability that owns the Office thread, which says a background reply once per wake. */
export const BACKGROUND_VOICE: unique symbol = Symbol("domain.agent-schedules.background-voice")

/** Injects the background voice port. Parameter type: BackgroundVoice. */
export const InjectBackgroundVoice = (): TypedParameterDecorator<BackgroundVoice> =>
    injector<BackgroundVoice>(BACKGROUND_VOICE)
