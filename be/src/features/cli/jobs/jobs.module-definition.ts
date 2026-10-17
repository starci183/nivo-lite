import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { CliJobsOptions } from "./jobs.options"

/** The configurable-module base of the jobs module. */
export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN, OPTIONS_TYPE } =
    new ConfigurableModuleBuilder<CliJobsOptions>().setClassMethodName("register").build()
