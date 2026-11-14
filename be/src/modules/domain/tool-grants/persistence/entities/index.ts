import { AccountAttachmentEntity } from "./account-attachment.entity"
import { ToolGrantEntity } from "./tool-grant.entity"
import { NodeAccountPolicyEntity } from "./node-account-policy.entity"
import { NodePolicyShadowTallyEntity } from "./node-policy-shadow-tally.entity"
import { NodeRightsSwitchEntity } from "./node-rights-switch.entity"

export {
    AccountAttachmentEntity,
    ToolGrantEntity,
    NodeAccountPolicyEntity,
    NodePolicyShadowTallyEntity,
    NodeRightsSwitchEntity,
}

/** The entities the tool-grants capability owns, collected by the database module. */
export const toolGrantsEntities: readonly [
    typeof ToolGrantEntity,
    typeof AccountAttachmentEntity,
    typeof NodeAccountPolicyEntity,
    typeof NodePolicyShadowTallyEntity,
    typeof NodeRightsSwitchEntity,
] = [
    ToolGrantEntity,
    AccountAttachmentEntity,
    NodeAccountPolicyEntity,
    NodePolicyShadowTallyEntity,
    NodeRightsSwitchEntity,
] as const
