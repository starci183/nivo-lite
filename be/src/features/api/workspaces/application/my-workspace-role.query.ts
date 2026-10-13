import { Query } from "@nestjs/cqrs"
import type { PresentedRole } from "@modules/domain/workspace-members"
import type { ExecuteParams } from "@modules/platform/cqrs"
import type { MyWorkspaceRoleRequest } from "./my-workspace-role.contracts"

/** Asks for the caller's role in the active workspace. */
export class MyWorkspaceRoleQuery extends Query<PresentedRole> {
    constructor(readonly params: ExecuteParams<MyWorkspaceRoleRequest>) {
        super()
    }
}
