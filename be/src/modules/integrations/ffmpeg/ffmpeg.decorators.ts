import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { FfmpegOptions } from "./ffmpeg.options"
import type { Ffmpeg } from "./ffmpeg.port"

/** Token of the ffmpeg options. */
export const FFMPEG_OPTIONS: unique symbol = Symbol("integrations.ffmpeg.options")

/** Token of the Ffmpeg port. */
export const FFMPEG: unique symbol = Symbol("integrations.ffmpeg.port")

/** Injects the ffmpeg options. Parameter type: FfmpegOptions. */
export const InjectFfmpegOptions = (): TypedParameterDecorator<FfmpegOptions> => injector<FfmpegOptions>(FFMPEG_OPTIONS)

/** Injects the ffmpeg port. Parameter type: Ffmpeg. */
export const InjectFfmpeg = (): TypedParameterDecorator<Ffmpeg> => injector<Ffmpeg>(FFMPEG)
