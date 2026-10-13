import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { VideoAssets } from "./video.contracts"
import type { VideoOptions } from "./video.options"

/** Token of the options of the video capability, exported so a spec can provide it. */
export const VIDEO_OPTIONS: unique symbol = Symbol("domain.video.options")

/** Injects the options of the video capability. Parameter type: VideoOptions. */
export const InjectVideoOptions = (): TypedParameterDecorator<VideoOptions> => injector<VideoOptions>(VIDEO_OPTIONS)

/** Token of the file store the render job reads assets from and writes videos to; the app root binds it to the storage integration. */
export const VIDEO_ASSETS: unique symbol = Symbol("domain.video.assets")

/** Injects the render job's file store. Parameter type: VideoAssets. */
export const InjectVideoAssets = (): TypedParameterDecorator<VideoAssets> => injector<VideoAssets>(VIDEO_ASSETS)
