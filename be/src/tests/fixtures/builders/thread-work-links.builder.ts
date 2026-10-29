import { threadWorkEntities } from "@modules/domain/thread-work"
import { entityOf } from "./entity.builder"

const [ThreadWorkEntity] = threadWorkEntities

/** Work that waits on the approval request r-1. */
export const linkedWorkOf = entityOf(ThreadWorkEntity, { approvalRequestId: "r-1" })

/** The same work, waiting on no approval request. */
export const unlinkedWorkOf = () => linkedWorkOf({ approvalRequestId: null })
