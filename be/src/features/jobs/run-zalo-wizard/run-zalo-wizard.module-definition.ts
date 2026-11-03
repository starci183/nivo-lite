import { defineConfigurableModule } from "@starci/nest-kit"
import type { RunZaloWizardOptions } from "./run-zalo-wizard.options"

/** The configurable-module base of the run-zalo-wizard module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    defineConfigurableModule<RunZaloWizardOptions>()
