import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { JOBS_OPTIONS } from "./jobs.decorators"
import type { JobsOptions } from "./jobs.options"

/** The configurable-module base of the jobs; `isGlobal` is decided by the app root. */
const definition = new ConfigurableModuleBuilder<JobsOptions>({
    optionsInjectionToken: JOBS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    JobsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: JobsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
