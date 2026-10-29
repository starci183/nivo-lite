import { JobOutboxEntity } from "./job-outbox.entity"
import { JobEntity } from "./job.entity"

export { JobEntity } from "./job.entity"
export type { JobState } from "./job.entity"
export { JobOutboxEntity } from "./job-outbox.entity"
export type { JobOutboxState } from "./job-outbox.entity"

/** Every entity of the jobs capability. */
export const jobsEntities = [JobEntity, JobOutboxEntity] as const
