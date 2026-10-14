import { ConfigurableModuleBuilder } from "@nestjs/common"
import type { JobOpsOptions } from "./job-ops.options"

/** The configurable module base of the jobs operations capability. */
export const { ConfigurableModuleClass, OPTIONS_TYPE } = new ConfigurableModuleBuilder<JobOpsOptions>()
    .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
    .build()
