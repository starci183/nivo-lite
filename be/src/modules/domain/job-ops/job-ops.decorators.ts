import { injector } from "@modules/platform/composition"
import type { TypedParameterDecorator } from "@modules/platform/composition"
import type { JobOpsOptions } from "./job-ops.options"

/** Token of the jobs operations options, exported so a spec can provide it. */
export const JOB_OPS_OPTIONS: unique symbol = Symbol("domain.job-ops.options")

/** Injects the jobs operations options. Parameter type: JobOpsOptions. */
export const InjectJobOpsOptions = (): TypedParameterDecorator<JobOpsOptions> =>
    injector<JobOpsOptions>(JOB_OPS_OPTIONS)
