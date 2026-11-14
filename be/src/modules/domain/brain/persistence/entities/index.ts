import { BrainPolicyDerivationEntity } from "./brain-policy-derivation.entity"
import { BrainPolicyEntity } from "./brain-policy.entity"
import { BrainSourceProfileEntity } from "./brain-source-profile.entity"

export { BrainPolicyDerivationEntity, BrainPolicyEntity, BrainSourceProfileEntity }
export type { BrainPolicyDerivationError, BrainPolicyDerivationStatus } from "./brain-policy-derivation.entity"
export type { BrainPolicyKind, BrainPolicyStatus } from "./brain-policy.entity"

/** Every entity the brain capability owns, collected by the database connection. */
export const brainEntities: readonly [
    typeof BrainSourceProfileEntity,
    typeof BrainPolicyEntity,
    typeof BrainPolicyDerivationEntity,
] = [BrainSourceProfileEntity, BrainPolicyEntity, BrainPolicyDerivationEntity] as const
