import { ConfigurableModuleBuilder } from "@nestjs/common"
import { META_OPTIONS } from "./meta.decorators"
import type { MetaOptions } from "./meta.options"

/** The configurable-module base of the meta integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<MetaOptions>({
        optionsInjectionToken: META_OPTIONS,
    })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
