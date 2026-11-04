import { defineCapabilityModule } from "@starci/nest-kit"
import { DATA_SOURCES_OPTIONS } from "./data-sources.decorators"
import type { DataSourcesModuleOptions } from "./data-sources.options"

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineCapabilityModule<DataSourcesModuleOptions>({
        optionsInjectionToken: DATA_SOURCES_OPTIONS,
    })
