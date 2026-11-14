import { injector, type TypedParameterDecorator } from "@modules/platform/composition"
import type { UsageNoticeDoor } from "./ai-usage-events.contracts"

/** Token of where the owner is told the allowance runs short, or of null when the app binds none (the mcp gateway). */
export const USAGE_NOTICE_DOOR: unique symbol = Symbol("domain.ai-usage-events.notice-door")

/** Injects where the owner is told, or null. Parameter type: UsageNoticeDoor | null. */
export const InjectUsageNoticeDoor = (): TypedParameterDecorator<UsageNoticeDoor | null> =>
    injector<UsageNoticeDoor | null>(USAGE_NOTICE_DOOR)
