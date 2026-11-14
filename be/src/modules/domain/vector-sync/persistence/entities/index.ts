import { VectorSyncStateEntity } from "./vector-sync-state.entity"

export { VectorSyncStateEntity }

/** The entities the vector-sync capability owns, for the app's connection. */
export const vectorSyncEntities: readonly [typeof VectorSyncStateEntity] = [VectorSyncStateEntity] as const
