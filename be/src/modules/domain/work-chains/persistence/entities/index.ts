import { WorkChainEntity } from "./work-chain.entity"

export { WorkChainEntity } from "./work-chain.entity"
export type { WorkChainTarget } from "./work-chain.entity"

/** Every entity of the work-chains capability. */
export const workChainsEntities = [WorkChainEntity] as const
