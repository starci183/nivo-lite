import type { CommandBus } from "@nestjs/cqrs"
import { Args, Mutation, Resolver } from "@nestjs/graphql"
import { CurrentPrincipal } from "@modules/domain/identity"
import { WorkspaceId } from "@modules/domain/workspace-members"
import { InjectCommandBus, type Principal } from "@modules/platform/cqrs"
import { RedraftPublicDocumentCommand } from "../../application/redraft-public-document.command"
import { PublicDocumentIdInput } from "./dto/public-document-id.input"
import { PublicDocumentType } from "./dto/public-document.type"
import { toRedraftPublicDocumentRequest, toRedraftPublicDocumentType } from "./redraft-public-document.mapper"

@Resolver()
/** GraphQL door of redraftPublicDocument. */
export class RedraftPublicDocumentResolver {
    constructor(@InjectCommandBus() private readonly commandBus: CommandBus) {}

    /** Asks NIVO to draft a public document again from the internal documents it was drafted from. */
    @Mutation(() => PublicDocumentType, { name: "redraftPublicDocument" })
    async redraftPublicDocument(
        @CurrentPrincipal() principal: Principal,
        @WorkspaceId() workspaceId: string,
        @Args("input") input: PublicDocumentIdInput,
    ): Promise<PublicDocumentType> {
        const result = await this.commandBus.execute(
            new RedraftPublicDocumentCommand({
                request: toRedraftPublicDocumentRequest(workspaceId, input),
                principal,
            }),
        )
        return toRedraftPublicDocumentType(result)
    }
}
