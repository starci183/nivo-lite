import { GraphNodeEffectEntity } from "./graph-node-effect.entity"

export { GraphNodeEffectEntity } from "./graph-node-effect.entity"

/** Every entity of the graph-nodes capability. */
export const graphNodesEntities: readonly [typeof GraphNodeEffectEntity] = [GraphNodeEffectEntity] as const
