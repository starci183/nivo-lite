import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { VideoOptions } from "./video.options"

/** Token of the options of the video capability, exported so a spec can provide it. */
export const VIDEO_OPTIONS: unique symbol = Symbol("domain.video.options")

/** Injects the options of the video capability. Parameter type: VideoOptions. */
export const InjectVideoOptions = (): TypedParameterDecorator<VideoOptions> => injector<VideoOptions>(VIDEO_OPTIONS)
