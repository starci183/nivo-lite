import { workThreadsEntities } from "@modules/domain/work-threads"
import { entityOf } from "./entity.builder"

const WorkThreadEntity: (typeof workThreadsEntities)[0] = workThreadsEntities[0]
type WorkThreadEntity = InstanceType<typeof WorkThreadEntity>

/** A work thread row; the overrides of one call replace its defaults. */
export const workThreadRow: (overrides?: Partial<WorkThreadEntity>) => WorkThreadEntity = entityOf(WorkThreadEntity, {
    id: "t-1",
    leadId: "l-1",
})
