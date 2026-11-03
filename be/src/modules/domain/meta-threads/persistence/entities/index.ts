import { MetaThreadEntity } from "./meta-thread.entity"

export { MetaThreadEntity }

/** The entities the meta-threads capability owns, collected by the database module. */
export const metaThreadsEntities: readonly [typeof MetaThreadEntity] = [MetaThreadEntity] as const
