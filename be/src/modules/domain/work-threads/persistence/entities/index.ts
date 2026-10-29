import { WorkThreadEntity } from "./work-thread.entity"

export { WorkThreadEntity } from "./work-thread.entity"
export type { WorkThreadState } from "./work-thread.entity"

/** Every entity of the work-threads capability. */
export const workThreadsEntities = [WorkThreadEntity] as const
