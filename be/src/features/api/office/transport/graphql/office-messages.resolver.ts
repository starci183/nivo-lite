import type { QueryBus } from "@nestjs/cqrs"
import { Args, Query, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectQueryBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { ListThreadMessagesQuery } from "../../application/list-thread-messages.query"
import { OfficeMessagePageType } from "./dto/office-message-page.type"
import { ListOfficeMessagesInput } from "./dto/list-office-messages.input"
import { toOfficeMessagePageType, toThreadQueryRequest } from "./office.mapper"

@Resolver()
/** GraphQL door of the Office thread. */
export class OfficeMessagesResolver {
    constructor(@InjectQueryBus() private readonly queryBus: QueryBus) {}

    /** Reads one page of the Office thread, newest first. */
    @Query(() => OfficeMessagePageType, { name: "officeMessages" })
    async officeMessages(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: ListOfficeMessagesInput,
    ): Promise<OfficeMessagePageType> {
        const result = await this.queryBus.execute(
            new ListThreadMessagesQuery({ request: toThreadQueryRequest(workspaceId, input), principal }),
        )
        return toOfficeMessagePageType(result)
    }
}
