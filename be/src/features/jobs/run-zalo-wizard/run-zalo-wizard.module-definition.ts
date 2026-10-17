import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { RunZaloWizardOptions } from "./run-zalo-wizard.options"

/** The configurable-module base of the run-zalo-wizard module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<RunZaloWizardOptions>().setClassMethodName("register").build()
