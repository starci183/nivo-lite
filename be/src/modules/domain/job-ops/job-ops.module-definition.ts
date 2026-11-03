import { ConfigurableModuleBuilder, ConfigurableModuleCls } from "@nestjs/common"
import { JOB_OPS_OPTIONS } from "./job-ops.decorators"
import type { JobOpsOptions } from "./job-ops.options"

/** The configurable module base of the jobs operations capability. */
const definition = new ConfigurableModuleBuilder<JobOpsOptions>({
    optionsInjectionToken: JOB_OPS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
export const ConfigurableModuleClass: ConfigurableModuleCls<
    JobOpsOptions,
    "register",
    "create",
    {
        isGlobal: boolean
    }
> = definition.ConfigurableModuleClass
export const OPTIONS_TYPE: JobOpsOptions &
    Partial<{
        isGlobal: boolean
    }> = definition.OPTIONS_TYPE
