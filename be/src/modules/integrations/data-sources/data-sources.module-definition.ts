import { ConfigurableModuleBuilder } from "@nestjs/common"
import { DATA_SOURCES_OPTIONS } from "./data-sources.decorators"
import type { DataSourcesOptions } from "./data-sources.options"

/** The configurable-module base of the data-sources integration; `isGlobal` is decided by the app root. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<DataSourcesOptions>({ optionsInjectionToken: DATA_SOURCES_OPTIONS })
        .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
        .build()
