import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { Json2VideoClient } from "./json2video.client"
import type { Json2VideoOptions } from "./json2video.options"

/** Token of the JSON2Video client. */
export const JSON2VIDEO: unique symbol = Symbol("integrations.json2video")

/** Token of the options of the JSON2Video integration, exported so a spec can provide it. */
export const JSON2VIDEO_OPTIONS: unique symbol = Symbol("integrations.json2video.options")

/** Injects the options of the JSON2Video integration. Parameter type: Json2VideoOptions. */
export const InjectJson2VideoOptions = (): TypedParameterDecorator<Json2VideoOptions> =>
    injector<Json2VideoOptions>(JSON2VIDEO_OPTIONS)

/** Injects the JSON2Video client. Parameter type: Json2VideoClient. */
export const InjectJson2Video = (): TypedParameterDecorator<Json2VideoClient> => injector<Json2VideoClient>(JSON2VIDEO)
