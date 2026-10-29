import { ConfigurableModuleBuilder } from "@nestjs/common"
import { OWNERS_OPTIONS } from "./owners.decorators"
import type { OwnersOptions } from "./owners.options"

/** The configurable-module base of the owners capability; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<OwnersOptions>({
        optionsInjectionToken: OWNERS_OPTIONS,
    })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
