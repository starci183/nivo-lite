import type { SetPolicyRequest, SetPolicyResult, UnsetPolicyRequest, UnsetPolicyResult } from "@modules/domain/brain"
import type { SetBrainPolicyResultType, UnsetBrainPolicyResultType } from "./dto/brain-policies.type"
import type { SetBrainPolicyInput, UnsetBrainPolicyInput } from "./dto/brain-policy.input"

/** Maps the GraphQL input to the request. */
export const toSetPolicyRequest = (workspaceId: string, input: SetBrainPolicyInput): SetPolicyRequest => ({
    workspaceId,
    factId: input.factId,
    value: input.value,
    validFrom: input.validFrom,
    validTo: input.validTo,
    audience: input.audience,
})

/** Maps the GraphQL input to the request. */
export const toUnsetPolicyRequest = (workspaceId: string, input: UnsetBrainPolicyInput): UnsetPolicyRequest => ({
    workspaceId,
    factId: input.factId,
    note: input.note,
})

/** Maps the result. */
export const toSetBrainPolicyResultType = (result: SetPolicyResult): SetBrainPolicyResultType => result

/** Maps the result. */
export const toUnsetBrainPolicyResultType = (result: UnsetPolicyResult): UnsetBrainPolicyResultType => result
