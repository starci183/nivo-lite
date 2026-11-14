import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { YoutubeClient } from "./youtube.client"
import type { YoutubeOptions } from "./youtube.options"

/** Token of the Youtube client. */
export const YOUTUBE: unique symbol = Symbol("integrations.youtube")

/** Token of the options of the Youtube integration, exported so a spec can provide it. */
export const YOUTUBE_OPTIONS: unique symbol = Symbol("integrations.youtube.options")

/** Injects the options of the Youtube integration. Parameter type: YoutubeOptions. */
export const InjectYoutubeOptions = (): TypedParameterDecorator<YoutubeOptions> =>
    injector<YoutubeOptions>(YOUTUBE_OPTIONS)

/** Injects the Youtube client. Parameter type: YoutubeClient. */
export const InjectYoutube = (): TypedParameterDecorator<YoutubeClient> => injector<YoutubeClient>(YOUTUBE)
