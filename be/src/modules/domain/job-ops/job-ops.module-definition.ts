import { ConfigurableModuleBuilder } from "@nestjs/common"
import { JOB_OPS_OPTIONS } from "./job-ops.decorators"
import type { JobOpsOptions } from "./job-ops.options"

/** The configurable module base of the jobs operations capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<JobOpsOptions>({
    optionsInjectionToken: JOB_OPS_OPTIONS,
})
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
