import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { PlatformAdminOptions } from "./platform-admin.options"

/** Token of the platform-admin options, exported so a spec can provide it. */
export const PLATFORM_ADMIN_OPTIONS: unique symbol = Symbol("domain.platform-admin.options")

/** Injects the options of the platform-admin capability. Parameter type: PlatformAdminOptions. */
export const InjectPlatformAdminOptions = (): TypedParameterDecorator<PlatformAdminOptions> =>
    injector<PlatformAdminOptions>(PLATFORM_ADMIN_OPTIONS)
