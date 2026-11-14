import { NodeEffectEntity } from "./node-effect.entity"

export { NodeEffectEntity }

/** The entities the graph nodes own, collected by the database module. */
export const graphNodesEntities: readonly [typeof NodeEffectEntity] = [NodeEffectEntity] as const
