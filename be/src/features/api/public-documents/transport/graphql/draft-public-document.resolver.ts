import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { DraftPublicDocumentCommand } from "../../application/draft-public-document.command"
import { DraftPublicDocumentInput } from "./dto/draft-public-document.input"
import { PublicDocumentType } from "./dto/public-document.type"
import { toDraftPublicDocumentRequest, toDraftPublicDocumentType } from "./draft-public-document.mapper"

@Resolver()
/** GraphQL door of draftPublicDocument. */
export class DraftPublicDocumentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Asks NIVO to draft a public document from internal documents; the draft is written in the background and waits for approval. */
    @Mutation(() => PublicDocumentType, { name: "draftPublicDocument" })
    async draftPublicDocument(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: DraftPublicDocumentInput,
    ): Promise<PublicDocumentType> {
        const result = await this.commandBus.execute(
            new DraftPublicDocumentCommand({ request: toDraftPublicDocumentRequest(workspaceId, input), principal }),
        )
        return toDraftPublicDocumentType(result)
    }
}
