import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { PostOfficeMessageCommand } from "../../application/post-office-message.command"
import { OfficeMessageType } from "./dto/office-message.type"
import { PostOfficeMessageInput } from "./dto/post-office-message.input"
import { toOfficeMessageType, toPostOfficeMessageRequest } from "./office.mapper"

@Resolver()
/** GraphQL door that posts a line in the Office thread. */
export class PostOfficeMessageResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Posts a line as the caller (their name and staff row); an owner or manager line is then sent to `proposeOfficeCommand`. */
    @Mutation(() => OfficeMessageType, { name: "postOfficeMessage" })
    async postOfficeMessage(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PostOfficeMessageInput,
    ): Promise<OfficeMessageType> {
        const result = await this.commandBus.execute(
            new PostOfficeMessageCommand({ request: toPostOfficeMessageRequest(workspaceId, input), principal }),
        )
        return toOfficeMessageType(result)
    }
}
