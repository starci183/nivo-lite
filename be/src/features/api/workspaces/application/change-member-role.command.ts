import { Command } from "@nestjs/cqrs"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { ChangeMemberRoleRequest } from "./change-member-role.contracts"

/** Asks to change the role of a member of the caller's workspace. */
export class ChangeMemberRoleCommand extends Command<void> {
    constructor(readonly params: ExecuteParams<ChangeMemberRoleRequest>) {
        super()
    }
}
