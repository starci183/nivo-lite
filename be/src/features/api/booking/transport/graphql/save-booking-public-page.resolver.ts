import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { SaveBookingPublicPageCommand } from "../../application/save-booking-public-page.command"
import { toSaveBookingPublicPageRequest, toSaveBookingPublicPageType } from "./save-booking-public-page.mapper"
import { SaveBookingPublicPageInput } from "./dto/save-booking-public-page.input"
import { SaveBookingPublicPageType } from "./dto/save-booking-public-page.type"

@Resolver()
/** GraphQL door for save booking public page. */
export class SaveBookingPublicPageResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Applies save booking public page for the selected workspace. */
    @Mutation(() => SaveBookingPublicPageType, { name: "saveBookingPublicPage" })
    async saveBookingPublicPage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: SaveBookingPublicPageInput,
    ): Promise<SaveBookingPublicPageType> {
        const result = await this.commandBus.execute(
            new SaveBookingPublicPageCommand({
                request: toSaveBookingPublicPageRequest(workspaceId, input),
                principal,
            }),
        )
        return toSaveBookingPublicPageType(result)
    }
}
