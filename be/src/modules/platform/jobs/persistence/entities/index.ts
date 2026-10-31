import { JobOutboxEntity } from "./job-outbox.entity"
import { JobSlotEntity } from "./job-slot.entity"
import { JobTickEntity } from "./job-tick.entity"
import { JobEntity } from "./job.entity"

export { JobEntity } from "./job.entity"
export type { JobState } from "./job.entity"
export { JobOutboxEntity } from "./job-outbox.entity"
export type { JobOutboxState } from "./job-outbox.entity"
export { JobSlotEntity } from "./job-slot.entity"
export { JobTickEntity } from "./job-tick.entity"

/** Every entity of the jobs capability. */
export const jobsEntities = [JobEntity, JobOutboxEntity, JobSlotEntity, JobTickEntity] as const
