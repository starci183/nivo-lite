import { defineCapabilityModule } from "@starci/nest-kit"
import { JOB_OPS_OPTIONS } from "./job-ops.decorators"
import type { JobOpsOptions } from "./job-ops.options"

export const { ConfigurableModuleClass, OPTIONS_TYPE } = defineCapabilityModule<JobOpsOptions>({
    optionsInjectionToken: JOB_OPS_OPTIONS,
})
