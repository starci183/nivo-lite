import { ContractEntity } from "./contract.entity"

export { ContractEntity }

/** The entities the contracts capability owns, for the app's connection. */
export const contractsEntities: readonly [typeof ContractEntity] = [ContractEntity] as const
