import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { SetWorkspaceEnterpriseKeyCommand } from "../../application/set-workspace-enterprise-key.command"
import { AdminEnterpriseKeySetType } from "./dto/admin-enterprise-key-set.type"
import { AdminSetWorkspaceEnterpriseKeyInput } from "./dto/admin-set-workspace-enterprise-key.input"
import {
    toAdminEnterpriseKeySetType,
    toAdminSetWorkspaceEnterpriseKeyRequest,
} from "./admin-set-workspace-enterprise-key.mapper"

@Resolver()
/** GraphQL door of adminSetWorkspaceEnterpriseKey. */
export class AdminSetWorkspaceEnterpriseKeyResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Sets the enterprise identifier of a workspace, or clears it: the private plugins that name it open to, or close for, the workspace. */
    @Mutation(() => AdminEnterpriseKeySetType, { name: "adminSetWorkspaceEnterpriseKey" })
    async adminSetWorkspaceEnterpriseKey(
        @CurrentPrincipal() principal: Principal,
        @Args("input") input: AdminSetWorkspaceEnterpriseKeyInput,
    ): Promise<AdminEnterpriseKeySetType> {
        const result = await this.commandBus.execute(
            new SetWorkspaceEnterpriseKeyCommand({ request: toAdminSetWorkspaceEnterpriseKeyRequest(input), principal }),
        )
        return toAdminEnterpriseKeySetType(result)
    }
}
