import type { CommandBus } from "@nestjs/cqrs"
import { Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ApplyContentCadencePresetsCommand } from "../../application/apply-content-cadence-presets.command"
import {
    toApplyContentCadencePresetsRequest,
    toApplyContentCadencePresetsType,
} from "./apply-content-cadence-presets.mapper"
import { SavedContentRowsType } from "./dto/saved-content-rows.type"

@Resolver()
/** GraphQL door of applyContentCadencePresets. */
export class ApplyContentCadencePresetsResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** applyContentCadencePresets for the selected workspace. */
    @Mutation(() => SavedContentRowsType, { name: "applyContentCadencePresets" })
    async applyContentCadencePresets(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
    ): Promise<SavedContentRowsType> {
        const result = await this.commandBus.execute(
            new ApplyContentCadencePresetsCommand({
                request: toApplyContentCadencePresetsRequest(workspaceId),
                principal,
            }),
        )
        return toApplyContentCadencePresetsType(result)
    }
}
