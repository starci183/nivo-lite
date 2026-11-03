import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunMarketingTickOptions } from "./run-marketing-tick.options"

/** The configurable-module base of the run-marketing-tick module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunMarketingTickOptions>()
