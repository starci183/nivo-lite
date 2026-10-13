import { ConfigurableModuleBuilder } from "@nestjs/common"
import { GOOGLE_OPTIONS } from "./google.decorators"
import type { GoogleOptions } from "./google.options"

/** The configurable-module base of the google integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<GoogleOptions>({ optionsInjectionToken: GOOGLE_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
