import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus } from "@modules/platform/cqrs"
import type { Principal } from "@modules/platform/cqrs"
import { UpdatePublicDocumentCommand } from "../../application/update-public-document.command"
import { UpdatePublicDocumentInput } from "./dto/update-public-document.input"
import { PublicDocumentType } from "./dto/public-document.type"
import { toUpdatePublicDocumentRequest, toUpdatePublicDocumentType } from "./update-public-document.mapper"

@Resolver()
/** GraphQL door of updatePublicDocument. */
export class UpdatePublicDocumentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Changes the title or the text of a public document; a published one serves its approved text until the new one is approved. */
    @Mutation(() => PublicDocumentType, { name: "updatePublicDocument" })
    async updatePublicDocument(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: UpdatePublicDocumentInput,
    ): Promise<PublicDocumentType> {
        const result = await this.commandBus.execute(
            new UpdatePublicDocumentCommand({ request: toUpdatePublicDocumentRequest(workspaceId, input), principal }),
        )
        return toUpdatePublicDocumentType(result)
    }
}
