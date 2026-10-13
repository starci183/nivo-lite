import { ConfigurableModuleBuilder } from "@nestjs/common"
import { ZALO_OPTIONS } from "./zalo.decorators"
import type { ZaloOptions } from "./zalo.options"

/** The configurable-module base of the Zalo integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<ZaloOptions>({ optionsInjectionToken: ZALO_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
