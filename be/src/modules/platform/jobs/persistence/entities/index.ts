import { JobEntity } from "./job.entity"

export { JobEntity } from "./job.entity"
export type { JobState } from "./job.entity"

/** Every entity of the jobs capability. */
export const jobsEntities = [JobEntity] as const
