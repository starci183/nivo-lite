import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SetContentAutomationCommand } from "../../application/set-content-automation.command"
import { toSetContentAutomationRequest, toSetContentAutomationType } from "./set-content-automation.mapper"
import { SetContentAutomationInput } from "./dto/set-content-automation.input"
import { ContentBrandSettingsType } from "./dto/content-brand-settings.type"

@Resolver()
/** GraphQL door of setContentAutomation. */
export class SetContentAutomationResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** setContentAutomation for the selected workspace. */
    @Mutation(() => ContentBrandSettingsType, { name: "setContentAutomation" })
    async setContentAutomation(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SetContentAutomationInput,
    ): Promise<ContentBrandSettingsType> {
        const result = await this.commandBus.execute(
            new SetContentAutomationCommand({
                request: toSetContentAutomationRequest(workspaceId, input),
                principal,
            }),
        )
        return toSetContentAutomationType(result)
    }
}
