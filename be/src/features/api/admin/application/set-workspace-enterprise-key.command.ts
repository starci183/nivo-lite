import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type {
    SetWorkspaceEnterpriseKeyRequest,
    SetWorkspaceEnterpriseKeyResult,
} from "./set-workspace-enterprise-key.contracts"

/** Sets or clears the enterprise identifier of a workspace. */
export class SetWorkspaceEnterpriseKeyCommand extends Command<SetWorkspaceEnterpriseKeyResult> {
    constructor(readonly params: ExecuteParams<SetWorkspaceEnterpriseKeyRequest>) {
        super()
    }
}
