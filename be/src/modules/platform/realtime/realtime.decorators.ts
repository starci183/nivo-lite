import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { RealtimePublisher } from "./realtime.port"

/** Token of the private realtime publishing capability. */
export const REALTIME_PUBLISHER: unique symbol = Symbol("platform.realtime.publisher")

/** Injects the RealtimePublisher port. Parameter type: RealtimePublisher. */
export const InjectRealtimePublisher = (): TypedParameterDecorator<RealtimePublisher> =>
    injector<RealtimePublisher>(REALTIME_PUBLISHER)
