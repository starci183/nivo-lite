import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SyncMembersCommand } from "../../application/sync-members.command"
import { toSyncLoyaltyMembersRequest, toSyncLoyaltyMembersType } from "./sync-loyalty-members.mapper"
import { SyncLoyaltyMembersType } from "./dto/sync-loyalty-members.type"

@Resolver()
/** The GraphQL door for sync loyalty members. */
export class SyncLoyaltyMembersResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Runs sync loyalty members for the selected workspace. */
    @Mutation(() => SyncLoyaltyMembersType, { name: "syncLoyaltyMembers" })
    async syncLoyaltyMembers(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<SyncLoyaltyMembersType> {
        const result = await this.commandBus.execute(
            new SyncMembersCommand({ request: toSyncLoyaltyMembersRequest(workspaceId), principal }),
        )
        return toSyncLoyaltyMembersType(result)
    }
}
