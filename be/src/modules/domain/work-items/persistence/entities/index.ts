import { WorkItemEntity } from "./work-item.entity"

export { WorkItemEntity } from "./work-item.entity"

/** Every entity of the work-items capability. */
export const workItemsEntities: readonly [typeof WorkItemEntity] = [WorkItemEntity] as const
