import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveContentBrandCommand } from "../../application/save-content-brand.command"
import { toSaveContentBrandRequest, toSaveContentBrandType } from "./save-content-brand.mapper"
import { SaveContentBrandInput } from "./dto/save-content-brand.input"
import { ContentBrandSettingsType } from "./dto/content-brand-settings.type"

@Resolver()
/** GraphQL door of saveContentBrand. */
export class SaveContentBrandResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** saveContentBrand for the selected workspace. */
    @Mutation(() => ContentBrandSettingsType, { name: "saveContentBrand" })
    async saveContentBrand(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveContentBrandInput,
    ): Promise<ContentBrandSettingsType> {
        const result = await this.commandBus.execute(
            new SaveContentBrandCommand({
                request: toSaveContentBrandRequest(workspaceId, input),
                principal,
            }),
        )
        return toSaveContentBrandType(result)
    }
}
