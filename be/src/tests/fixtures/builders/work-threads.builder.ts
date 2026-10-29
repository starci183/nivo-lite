import { workThreadsEntities } from "@modules/domain/work-threads"
import { entityOf } from "./entity.builder"

const [WorkThreadEntity] = workThreadsEntities

/** A work thread row; the overrides of one call replace its defaults. */
export const workThreadRow = entityOf(WorkThreadEntity, { id: "t-1", leadId: "l-1" })
