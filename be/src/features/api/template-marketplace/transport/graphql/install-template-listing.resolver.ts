import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import type { Principal } from "@modules/platform/cqrs"
import { InstallTemplateListingCommand } from "../../application/install-template-listing.command"
import { InstalledTemplateType } from "./dto/installed-template.type"
import { InstallTemplateListingInput } from "./dto/install-template-listing.input"
import { toInstallTemplateListingRequest, toInstallTemplateListingType } from "./install-template-listing.mapper"

@Resolver()
/** GraphQL door of installTemplateListing. */
export class InstallTemplateListingResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Installs an approved listing as a new agent in shadow mode; a paid one needs its settled order. */
    @Mutation(() => InstalledTemplateType, { name: "installTemplateListing" })
    async installTemplateListing(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: InstallTemplateListingInput,
        @AcceptedLocale() locale: Locale,
    ): Promise<InstalledTemplateType> {
        const result = await this.commandBus.execute(
            new InstallTemplateListingCommand({
                request: toInstallTemplateListingRequest(workspaceId, input, locale),
                principal,
            }),
        )
        return toInstallTemplateListingType(result)
    }
}
