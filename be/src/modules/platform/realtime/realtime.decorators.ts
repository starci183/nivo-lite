import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { RealtimeHub, RealtimePublisher } from "./realtime.port"

/** Token of the private realtime publishing capability. */
export const REALTIME_PUBLISHER: unique symbol = Symbol("platform.realtime.publisher")

/** Injects the RealtimePublisher port. Parameter type: RealtimePublisher. */
export const InjectRealtimePublisher = (): TypedParameterDecorator<RealtimePublisher> =>
    injector<RealtimePublisher>(REALTIME_PUBLISHER)

/** Token of the RealtimeHub port. */
export const REALTIME_HUB: unique symbol = Symbol("platform.realtime.hub")

/** Injects the RealtimeHub port. Parameter type: RealtimeHub. */
export const InjectRealtimeHub = (): TypedParameterDecorator<RealtimeHub> => injector<RealtimeHub>(REALTIME_HUB)
