import { threadWorkEntities } from "@modules/domain/thread-work"
import { entityOf } from "./entity.builder"

const ThreadWorkEntity: (typeof threadWorkEntities)[0] = threadWorkEntities[0]
type ThreadWorkEntity = InstanceType<typeof ThreadWorkEntity>

/** Work that waits on the approval request r-1. */
export const linkedWorkOf: (overrides?: Partial<ThreadWorkEntity>) => ThreadWorkEntity = entityOf(ThreadWorkEntity, {
    approvalRequestId: "r-1",
})

/** The same work, waiting on no approval request. */
export const unlinkedWorkOf = (): ThreadWorkEntity => linkedWorkOf({ approvalRequestId: null })
