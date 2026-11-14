import { AccountAttachmentEntity } from "./account-attachment.entity"
import { ToolGrantEntity } from "./tool-grant.entity"
import { NodeAccountPolicyEntity } from "./node-account-policy.entity"
import { NodeRightsSwitchEntity } from "./node-rights-switch.entity"

export {
    AccountAttachmentEntity,
    ToolGrantEntity,
    NodeAccountPolicyEntity,
    NodeRightsSwitchEntity,
}

/** The entities the tool-grants capability owns, collected by the database module. */
export const toolGrantsEntities: readonly [
    typeof ToolGrantEntity,
    typeof AccountAttachmentEntity,
    typeof NodeAccountPolicyEntity,
    typeof NodeRightsSwitchEntity,
] = [
    ToolGrantEntity,
    AccountAttachmentEntity,
    NodeAccountPolicyEntity,
    NodeRightsSwitchEntity,
] as const
