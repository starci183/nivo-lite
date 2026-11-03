import { defineConfigurableModule } from "@starci/nest-kit"
import type { OfficeApiOptions } from "./office.options"

/** The configurable-module base of the office module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<OfficeApiOptions>()
