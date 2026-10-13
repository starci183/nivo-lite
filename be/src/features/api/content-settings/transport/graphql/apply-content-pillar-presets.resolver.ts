import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ApplyContentPillarPresetsCommand } from "../../application/apply-content-pillar-presets.command"
import {
    toApplyContentPillarPresetsRequest,
    toApplyContentPillarPresetsType,
} from "./apply-content-pillar-presets.mapper"
import { SavedContentRowsType } from "./dto/saved-content-rows.type"

@Resolver()
/** GraphQL door of applyContentPillarPresets. */
export class ApplyContentPillarPresetsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** applyContentPillarPresets for the selected workspace. */
    @Mutation(() => SavedContentRowsType, { name: "applyContentPillarPresets" })
    async applyContentPillarPresets(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<SavedContentRowsType> {
        const result = await this.commandBus.execute(
            new ApplyContentPillarPresetsCommand({
                request: toApplyContentPillarPresetsRequest(workspaceId),
                principal,
            }),
        )
        return toApplyContentPillarPresetsType(result)
    }
}
