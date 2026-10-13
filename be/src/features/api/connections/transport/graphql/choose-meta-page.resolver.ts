import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ChooseMetaPageCommand } from "../../application/choose-meta-page.command"
import { ChooseMetaPageInput } from "./dto/choose-meta-page.input"
import { MetaWizardConnectionType } from "./dto/meta-wizard-connection.type"
import { toChooseMetaPageRequest, toChooseMetaPageType } from "./choose-meta-page.mapper"

@Resolver()
/** GraphQL door of chooseMetaPage. */
export class ChooseMetaPageResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Chooses the Page of a Meta connection. */
    @Mutation(() => MetaWizardConnectionType, { name: "chooseMetaPage" })
    async chooseMetaPage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ChooseMetaPageInput,
    ): Promise<MetaWizardConnectionType> {
        const result = await this.commandBus.execute(
            new ChooseMetaPageCommand({ request: toChooseMetaPageRequest(workspaceId, input), principal }),
        )
        return toChooseMetaPageType(result)
    }
}
