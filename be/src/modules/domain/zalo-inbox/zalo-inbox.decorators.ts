import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { ZaloInboxOptions } from "./zalo-inbox.options"

/** Token of the zalo-inbox options, exported so a spec can provide it. */
export const ZALO_INBOX_OPTIONS: unique symbol = Symbol("domain.zalo-inbox.options")

/** Injects the options of the zalo-inbox capability. Parameter type: ZaloInboxOptions. */
export const InjectZaloInboxOptions = (): TypedParameterDecorator<ZaloInboxOptions> =>
    injector<ZaloInboxOptions>(ZALO_INBOX_OPTIONS)
