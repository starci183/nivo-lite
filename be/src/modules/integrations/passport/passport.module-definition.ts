import { ConfigurableModuleBuilder } from "@nestjs/common"
import { PASSPORT_OPTIONS } from "./passport.decorators"
import type { PassportOptions } from "./passport.options"

/** The configurable-module base of the passport integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<PassportOptions>({ optionsInjectionToken: PASSPORT_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
