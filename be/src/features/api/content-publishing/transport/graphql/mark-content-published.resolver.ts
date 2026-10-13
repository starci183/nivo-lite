import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { AcceptedLocale } from "@modules/platform/i18n"
import type { Locale } from "@modules/platform/i18n"
import { MarkContentPublishedCommand } from "../../application/mark-content-published.command"
import { MarkContentPublishedInput } from "./dto/mark-content-published.input"
import { MarkContentPublishedType } from "./dto/mark-content-published.type"
import { toMarkContentPublishedRequest, toMarkContentPublishedType } from "./mark-content-published.mapper"

@Resolver()
/** GraphQL door of manually supplied publication proof. */
export class MarkContentPublishedResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Saves the channel proof on an approved content item. */
    @Mutation(() => MarkContentPublishedType, { name: "markContentPublished" })
    async markContentPublished(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @AcceptedLocale() locale: Locale,
        @Args("input") input: MarkContentPublishedInput,
    ): Promise<MarkContentPublishedType> {
        const result = await this.commandBus.execute(
            new MarkContentPublishedCommand({
                request: toMarkContentPublishedRequest(workspaceId, locale, input),
                principal,
            }),
        )
        return toMarkContentPublishedType(result)
    }
}
